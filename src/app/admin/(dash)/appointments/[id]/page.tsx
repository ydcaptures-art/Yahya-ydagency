import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, Mail, MessageCircle } from "lucide-react";
import { adminPage } from "@/lib/admin";
import { can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getAppointment } from "@/lib/booking";
import { getEmployees } from "@/lib/catalog";
import { pick } from "@/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDate, formatTime, toDateKey } from "@/lib/time";
import { PageHeader, Panel, Badge, Flash, Field } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { setStatusAction, rescheduleAction, updateNotesAction } from "../actions";

export default async function AppointmentDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { user, salon, locale, t, dict } = await adminPage(["owner", "manager", "staff"]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const a = await getAppointment(salon.id, id);
  if (!a) notFound();
  if (!can.manageAllAppointments(user) && a.employee.id !== user.employee_id) notFound();

  const [events, notes, employees] = await Promise.all([
    sql<{ event: string; details: Record<string, unknown>; actor: string; created_at: Date; actor_name: string | null }[]>`
      select ev.event, ev.details, ev.actor, ev.created_at, u.full_name as actor_name from appointment_events ev
      left join users u on u.id::text = ev.actor where ev.appointment_id = ${id} order by ev.created_at`,
    sql<{ channel: string; type: string; status: string; error: string | null; created_at: Date }[]>`
      select channel, type, status, error, created_at from notifications where appointment_id = ${id} order by created_at`,
    getEmployees(salon.id),
  ]);
  const ta = t.appointments;
  const tz = salon.timezone;
  const active = a.status === "pending" || a.status === "confirmed";
  const branchEmployees = employees.filter((e) => e.branch_id === a.branch.id && (can.manageAllAppointments(user) || e.id === user.employee_id));
  const errors: Record<string, string> = { conflict: ta.conflict, not_active: dict.manage.statuses[a.status], invalid: dict.booking.genericError };
  const wa = a.customer.phone.replace(/\D/g, "");

  return (
    <>
      <Link href="/admin/appointments" className="mb-4 inline-flex items-center gap-1 text-sm text-mocha hover:text-espresso"><ArrowLeft className="size-4" /> {ta.title}</Link>
      <Flash saved={sp.saved} error={sp.error ? errors[sp.error] ?? dict.booking.genericError : undefined} savedText={t.common.saved} />
      <PageHeader
        title={`${a.customer.first_name} ${a.customer.last_name}`}
        subtitle={`${ta.reference} ${a.reference} · ${ta.source}: ${a.source}`}
        actions={<Badge status={a.status} label={dict.manage.statuses[a.status]} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title={ta.details}>
            <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-taupe">{t.common.date}</dt><dd className="font-medium">{formatDate(a.starts_at, locale, tz)}</dd></div>
              <div><dt className="text-xs text-taupe">{t.common.time}</dt><dd className="font-medium">{formatTime(a.starts_at, locale, tz)} – {formatTime(a.ends_at, locale, tz)}</dd></div>
              <div><dt className="text-xs text-taupe">{t.common.branch}</dt><dd className="font-medium">{a.branch.name}</dd></div>
              <div><dt className="text-xs text-taupe">{t.common.employee}</dt><dd className="font-medium">{a.employee.first_name} {a.employee.last_name}{a.employee_was_requested ? " ★" : ""}</dd></div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-taupe">{t.common.services}</dt>
                <dd>
                  <ul className="mt-1 divide-y divide-line rounded-xl border border-line">
                    {a.services.map((s, i) => (
                      <li key={i} className="flex justify-between gap-3 px-3 py-2">
                        <span>{pick(s.name, locale)} <span className="text-xs text-taupe">· {s.duration_minutes} {t.common.minutes}</span></span>
                        <span className="tabular-nums">{formatMoney(s.price_cents, salon.currency, locale)}</span>
                      </li>
                    ))}
                    <li className="flex justify-between bg-cream/50 px-3 py-2 font-semibold">
                      <span>{dict.booking.estimatedTotal}</span>
                      <span className="tabular-nums">{formatMoney(a.total_price_cents, salon.currency, locale)}</span>
                    </li>
                  </ul>
                </dd>
              </div>
              {a.customer_notes && (
                <div className="sm:col-span-2"><dt className="text-xs text-taupe">{ta.customerNotes}</dt><dd className="mt-1 rounded-xl bg-cream/60 p-3 whitespace-pre-line">{a.customer_notes}</dd></div>
              )}
              {a.cancel_reason && <div className="sm:col-span-2"><dt className="text-xs text-taupe">{ta.cancelReason}</dt><dd>{a.cancel_reason}</dd></div>}
            </dl>

            {(active || a.status === "no_show") && (
              <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
                {a.status === "pending" && (
                  <form action={setStatusAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="confirmed" />
                    <SubmitButton className="btn-primary px-4 py-2">{ta.confirm}</SubmitButton></form>
                )}
                <form action={setStatusAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="completed" />
                  <SubmitButton className="btn-gold px-4 py-2">{ta.complete}</SubmitButton></form>
                {active && (
                  <form action={setStatusAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="no_show" />
                    <SubmitButton className="btn-outline px-4 py-2">{ta.noShow}</SubmitButton></form>
                )}
              </div>
            )}
          </Panel>

          {active && (
            <Panel title={ta.reschedule}>
              <form action={rescheduleAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <input type="hidden" name="id" value={a.id} />
                <Field label={t.common.date}><input type="date" name="date" required defaultValue={toDateKey(a.starts_at, tz)} className="input-sm" /></Field>
                <Field label={t.common.time}><input type="time" name="time" required step={300} defaultValue={formatTime(a.starts_at, "en", tz)} className="input-sm" /></Field>
                <Field label={t.common.employee} className="sm:col-span-2">
                  <select name="employeeId" defaultValue={a.employee.id} className="input-sm">
                    {can.manageAllAppointments(user) && <option value="any">{dict.booking.anyProfessional}</option>}
                    {branchEmployees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="override" className="checkbox" /> {ta.allowOutsideHours}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked className="checkbox" /> {ta.notifyCustomer}</label>
                <div className="sm:col-span-2 lg:col-span-4"><SubmitButton>{ta.reschedule}</SubmitButton></div>
              </form>
            </Panel>
          )}

          {active && (
            <Panel title={ta.cancel}>
              <form action={setStatusAction} className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="cancelled" />
                <Field label={ta.cancelReason}><input name="reason" maxLength={300} className="input-sm" /></Field>
                <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="notify" defaultChecked className="checkbox" /> {ta.notifyCustomer}</label>
                <SubmitButton className="btn bg-danger px-5 py-2.5 text-porcelain hover:opacity-90" confirm={dict.manage.cancelConfirm}>{ta.cancel}</SubmitButton>
              </form>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title={t.common.customer}>
            <p className="font-medium">{a.customer.first_name} {a.customer.last_name}</p>
            <div className="mt-3 space-y-2 text-sm">
              <a href={`tel:${a.customer.phone}`} className="flex items-center gap-2 hover:text-gold-dark"><Phone className="size-4" /> {a.customer.phone}</a>
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-gold-dark"><MessageCircle className="size-4" /> WhatsApp</a>
              {a.customer.email && <a href={`mailto:${a.customer.email}`} className="flex items-center gap-2 break-all hover:text-gold-dark"><Mail className="size-4" /> {a.customer.email}</a>}
            </div>
            {can.manageAllAppointments(user) && (
              <Link href={`/admin/customers/${a.customer.id}`} className="mt-4 inline-block text-xs font-semibold text-gold-dark hover:underline">{t.customers.history} →</Link>
            )}
          </Panel>

          <Panel title={ta.internalNotes}>
            <form action={updateNotesAction} className="space-y-3">
              <input type="hidden" name="id" value={a.id} />
              <textarea name="internal_notes" rows={4} defaultValue={a.internal_notes ?? ""} className="input-sm" />
              <SubmitButton className="btn-outline px-4 py-2">{t.common.save}</SubmitButton>
            </form>
          </Panel>

          <Panel title={ta.history}>
            <ol className="space-y-3 text-sm">
              {events.map((e, i) => (
                <li key={i} className="border-l-2 border-champagne pl-3">
                  <p className="font-medium capitalize">{e.event.replace("_", " ")}</p>
                  <p className="text-xs text-taupe">{formatDate(e.created_at, locale, tz, { weekday: undefined, year: undefined })} {formatTime(e.created_at, locale, tz)} · {e.actor_name ?? e.actor}</p>
                </li>
              ))}
              {notes.map((n, i) => (
                <li key={`n${i}`} className="border-l-2 border-line pl-3">
                  <p className="flex items-center gap-2 text-xs">
                    {n.channel} · {t.notificationsPage.types[n.type as keyof typeof t.notificationsPage.types]}
                    <Badge status={n.status} label={t.notificationsPage.statuses[n.status as keyof typeof t.notificationsPage.statuses]} />
                  </p>
                  {n.error && <p className="text-[11px] text-taupe">{n.error}</p>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
