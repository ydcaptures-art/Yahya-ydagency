import "server-only";
import { sql, isUniqueViolation } from "./db";
import { getAppointment, type AppointmentDetails } from "./booking";
import type { Salon } from "./catalog";
import { getDictionary, fmt } from "@/i18n/dictionaries";
import { isLocale, pick, type Locale } from "@/i18n/config";
import { formatDate, formatTime } from "./time";
import { formatMoney } from "./money";

export type NotificationType = "confirmation" | "reminder" | "cancellation" | "reschedule";
type Channel = "email" | "whatsapp";

export function providerStatus() {
  return {
    email: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    whatsapp: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  };
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Queue and immediately attempt delivery of a notification on every channel
 * the salon has enabled and the customer can be reached on.
 * Returns the channels that were actually delivered (never assumed).
 */
export async function notifyAppointment(salon: Salon, appointmentId: string, type: NotificationType): Promise<Channel[]> {
  const appt = await getAppointment(salon.id, appointmentId);
  if (!appt) return [];
  const locale: Locale = isLocale(appt.locale) ? appt.locale : "tr";
  const channels: { channel: Channel; recipient: string }[] = [];
  if (salon.notify_email && appt.customer.email) channels.push({ channel: "email", recipient: appt.customer.email });
  if (salon.notify_whatsapp && appt.customer.phone) channels.push({ channel: "whatsapp", recipient: appt.customer.phone });

  const delivered: Channel[] = [];
  for (const { channel, recipient } of channels) {
    // Dedupe: a reminder is sent once per start time; other types once per event moment
    const dedupe =
      type === "reminder"
        ? `reminder:${channel}:${appt.id}:${new Date(appt.starts_at).toISOString()}`
        : `${type}:${channel}:${appt.id}:${Date.now()}`;
    let id: string;
    try {
      const [row] = await sql<{ id: string }[]>`
        insert into notifications (salon_id, appointment_id, channel, type, recipient, locale, dedupe_key)
        values (${salon.id}, ${appt.id}, ${channel}, ${type}, ${recipient}, ${locale}, ${dedupe}) returning id`;
      id = row.id;
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
    if (await deliver(id, salon, appt, channel, type, recipient, locale)) delivered.push(channel);
  }

  // Internal copy of new bookings for the salon team
  if (type === "confirmation" && salon.staff_notification_email && providerStatus().email) {
    const t = getDictionary("en");
    await sendEmail(
      salon.staff_notification_email,
      `New booking ${appt.reference} — ${appt.customer.first_name} ${appt.customer.last_name}`,
      renderEmail(salon, appt, "confirmation", "en", t.notifications.confirmationIntro),
    ).catch(() => undefined);
  }
  return delivered;
}

/** Retry a failed/skipped notification from the dashboard */
export async function retryNotification(salon: Salon, notificationId: string) {
  const [n] = await sql<{ id: string; appointment_id: string; channel: Channel; type: NotificationType; recipient: string; locale: string }[]>`
    select id, appointment_id, channel, type, recipient, locale from notifications
    where id = ${notificationId} and salon_id = ${salon.id} and status in ('failed', 'skipped')`;
  if (!n) return false;
  const appt = await getAppointment(salon.id, n.appointment_id);
  if (!appt) return false;
  return deliver(n.id, salon, appt, n.channel, n.type, n.recipient, isLocale(n.locale) ? n.locale : "tr");
}

async function deliver(
  id: string,
  salon: Salon,
  appt: AppointmentDetails,
  channel: Channel,
  type: NotificationType,
  recipient: string,
  locale: Locale,
): Promise<boolean> {
  const providers = providerStatus();
  if (!providers[channel]) {
    await sql`update notifications set status = 'skipped', attempts = attempts + 1,
      error = ${channel === "email" ? "Email provider not configured (RESEND_API_KEY / EMAIL_FROM)" : "WhatsApp Business API not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)"}
      where id = ${id}`;
    return false;
  }
  try {
    let providerId: string | null = null;
    if (channel === "email") {
      const t = getDictionary(locale).notifications;
      const date = formatDate(appt.starts_at, locale, salon.timezone, { year: undefined });
      const subject = fmt(t[`${type}Subject`], { salon: salon.name, date });
      const intro = t[`${type}Intro`];
      providerId = await sendEmail(recipient, subject, renderEmail(salon, appt, type, locale, intro));
    } else {
      providerId = await sendWhatsApp(recipient, type, locale, salon, appt);
    }
    await sql`update notifications set status = 'sent', sent_at = now(), attempts = attempts + 1, error = null,
      provider_message_id = ${providerId} where id = ${id}`;
    return true;
  } catch (err) {
    await sql`update notifications set status = 'failed', attempts = attempts + 1, error = ${String((err as Error).message).slice(0, 500)}
      where id = ${id}`;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------
async function sendEmail(to: string, subject: string, html: string): Promise<string | null> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body?.message ?? res.statusText}`);
  return body?.id ?? null;
}

/**
 * WhatsApp Business Cloud API (Meta). Business-initiated messages must use
 * pre-approved templates; we send one template per notification type with
 * body parameters: name, salon, date, time, branch, reference.
 */
async function sendWhatsApp(to: string, type: NotificationType, locale: Locale, salon: Salon, appt: AppointmentDetails) {
  const templateEnv: Record<NotificationType, string | undefined> = {
    confirmation: process.env.WHATSAPP_TEMPLATE_CONFIRMATION,
    reminder: process.env.WHATSAPP_TEMPLATE_REMINDER,
    cancellation: process.env.WHATSAPP_TEMPLATE_CANCELLATION,
    reschedule: process.env.WHATSAPP_TEMPLATE_RESCHEDULE,
  };
  const template = templateEnv[type];
  if (!template) throw new Error(`No WhatsApp template configured for "${type}"`);
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  const params = [
    appt.customer.first_name,
    salon.name,
    formatDate(appt.starts_at, locale, salon.timezone, { year: undefined }),
    formatTime(appt.starts_at, locale, salon.timezone),
    appt.branch.name,
    appt.reference,
  ].map((text) => ({ type: "text", text }));
  const res = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: { name: template, language: { code: locale }, components: [{ type: "body", parameters: params }] },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${body?.error?.message ?? res.statusText}`);
  return body?.messages?.[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Email template — table-based for email-client compatibility
// ---------------------------------------------------------------------------
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderEmail(salon: Salon, appt: AppointmentDetails, type: NotificationType, locale: Locale, intro: string): string {
  const d = getDictionary(locale);
  const t = d.notifications;
  const tz = salon.timezone;
  const manageUrl = `${siteUrl()}/${locale}/booking/manage/${appt.manage_token}`;
  const bookUrl = `${siteUrl()}/${locale}/booking`;
  const rows: [string, string][] = [
    [d.booking.reference, appt.reference],
    [d.booking.when, `${formatDate(appt.starts_at, locale, tz)} · ${formatTime(appt.starts_at, locale, tz)}`],
    [d.booking.where, `${salon.name} ${appt.branch.name} — ${appt.branch.address}, ${appt.branch.city}`],
    [d.booking.with, `${appt.employee.first_name} ${appt.employee.last_name}`],
    [d.booking.services, appt.services.map((s) => pick(s.name, locale)).join(", ")],
    [d.booking.estimatedTotal, formatMoney(appt.total_price_cents, salon.currency, locale)],
  ];
  const cta = type === "cancellation" ? { url: bookUrl, label: t.bookAgainCta } : { url: manageUrl, label: t.manageCta };
  return `<!doctype html><html lang="${locale}"><body style="margin:0;background:#f6f1ea;font-family:Helvetica,Arial,sans-serif;color:#2b211b">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1ea;padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fffdf9;border-radius:16px;overflow:hidden">
<tr><td style="padding:36px 40px 8px;text-align:center;font-family:Georgia,serif;font-size:26px;letter-spacing:.06em">${esc(salon.name)}</td></tr>
<tr><td style="padding:0 40px 24px;text-align:center;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#a07d4f">${esc(pick(salon.tagline, locale))}</td></tr>
<tr><td style="padding:8px 40px 0;font-size:15px;line-height:1.6">${esc(fmt(t.greeting, { name: appt.customer.first_name }))}<br>${esc(intro)}</td></tr>
<tr><td style="padding:20px 40px"><table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eadfce">
${rows.map(([k, v]) => `<tr><td style="padding:12px 0;border-bottom:1px solid #eadfce;font-size:12px;color:#8a7360;text-transform:uppercase;letter-spacing:.08em;width:38%">${esc(k)}</td><td style="padding:12px 0;border-bottom:1px solid #eadfce;font-size:15px${type === "cancellation" ? ";text-decoration:line-through;color:#8a7360" : ""}">${esc(v)}</td></tr>`).join("")}
</table></td></tr>
<tr><td style="padding:8px 40px 32px" align="center"><a href="${cta.url}" style="display:inline-block;background:#2b211b;color:#fffdf9;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:14px;letter-spacing:.04em">${esc(cta.label)}</a></td></tr>
<tr><td style="padding:0 40px 32px;font-size:13px;line-height:1.6;color:#6b5848">${esc(pick(salon.cancellation_policy, locale))}<br><br>${esc(t.signoff)}<br>${esc(salon.name)}${salon.phone ? ` · ${esc(salon.phone)}` : ""}</td></tr>
</table>
<p style="font-size:11px;color:#a8988a;margin-top:16px">${esc(fmt(t.footerNote, { salon: salon.name }))}</p>
</td></tr></table></body></html>`;
}

// ---------------------------------------------------------------------------
// Reminders (called by the cron endpoint)
// ---------------------------------------------------------------------------
export async function sendDueReminders(salon: Salon) {
  // Appointments starting within the reminder window that were booked before the window opened
  const due = await sql<{ id: string }[]>`
    select a.id from appointments a
    where a.salon_id = ${salon.id} and a.status in ('pending', 'confirmed')
      and a.starts_at > now()
      and a.starts_at <= now() + make_interval(hours => ${salon.reminder_hours_before})
      and a.created_at < a.starts_at - make_interval(hours => 2)
      and not exists (
        select 1 from notifications n where n.appointment_id = a.id and n.type = 'reminder'
          and n.dedupe_key like '%' || to_char(a.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI') || '%')
    limit 200`;
  let sent = 0;
  for (const a of due) sent += (await notifyAppointment(salon, a.id, "reminder")).length;
  return { due: due.length, sent };
}
