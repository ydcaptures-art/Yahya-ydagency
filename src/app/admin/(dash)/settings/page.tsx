import { cookies } from "next/headers";
import { KeyRound } from "lucide-react";
import { adminPage } from "@/lib/admin";
import { sql } from "@/lib/db";
import { getEmployees } from "@/lib/catalog";
import { PageHeader, Panel, Flash, Field, LocalizedInput, Badge } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveSettingsAction, createUserAction, toggleUserAction, resetUserPasswordAction } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; created?: string }> }) {
  const sp = await searchParams;
  const { user, salon, t, dict } = await adminPage(["owner"]);
  const [users, employees] = await Promise.all([
    sql<{ id: string; email: string; full_name: string; role: "owner" | "manager" | "staff"; is_active: boolean; last_login_at: Date | null; employee_id: string | null }[]>`
      select id, email, full_name, role, is_active, last_login_at, employee_id from users where salon_id = ${salon.id} order by role, full_name`,
    getEmployees(salon.id),
  ]);
  let temp: { email: string; temp: string } | null = null;
  if (sp.created) {
    try { temp = JSON.parse((await cookies()).get("yd_temp_pw")?.value ?? "null"); } catch { temp = null; }
  }
  const ts = t.settings;
  const errors: Record<string, string> = { invalid: dict.booking.genericError, exists: "Email already in use", employee: ts.linkedEmployee, self: t.common.forbidden };
  const stats = salon.trust_stats ?? {};
  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <Panel title={title}>
      <form action={saveSettingsAction} id={id} className="scroll-mt-20 space-y-4">
        <input type="hidden" name="section" value={id} />
        {children}
        <SubmitButton>{t.common.save}</SubmitButton>
      </form>
    </Panel>
  );

  return (
    <>
      <PageHeader title={ts.title} />
      <Flash saved={sp.saved} error={sp.error ? errors[sp.error] ?? dict.booking.genericError : undefined} savedText={t.common.saved} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Section id="salon" title={ts.salon}>
          <Field label={ts.salonName}><input name="name" defaultValue={salon.name} required className="input-sm" /></Field>
          <LocalizedInput name="tagline" label={ts.tagline} value={salon.tagline} />
          <LocalizedInput name="about" label={ts.about} value={salon.about} textarea />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.common.email}><input name="email" type="email" defaultValue={salon.email ?? ""} className="input-sm" /></Field>
            <Field label={t.common.phone}><input name="phone" defaultValue={salon.phone ?? ""} className="input-sm" /></Field>
            <Field label={ts.whatsapp}><input name="whatsapp" inputMode="numeric" defaultValue={salon.whatsapp ?? ""} className="input-sm" /></Field>
            <Field label="Default country code (phone)"><input name="phone_country_code" inputMode="numeric" defaultValue={salon.phone_country_code} className="input-sm" /></Field>
          </div>
          <Field label={ts.heroImage}><input name="hero_image_url" type="url" defaultValue={salon.hero_image_url ?? ""} className="input-sm" /></Field>
          <Field label={ts.logo}><input name="logo_url" type="url" defaultValue={salon.logo_url ?? ""} className="input-sm" /></Field>
          <fieldset className="grid grid-cols-4 gap-2">
            <legend className="mb-1 text-xs font-semibold text-mocha">Trust indicators</legend>
            <input name="stat_rating" placeholder="4.9" defaultValue={stats.rating ?? ""} className="input-sm" aria-label={dict.home.trustRating} />
            <input name="stat_reviews" placeholder="reviews" defaultValue={stats.reviews ?? ""} className="input-sm" aria-label="Reviews" />
            <input name="stat_clients" placeholder="clients" defaultValue={stats.clients ?? ""} className="input-sm" aria-label={dict.home.trustClients} />
            <input name="stat_years" placeholder="years" defaultValue={stats.years ?? ""} className="input-sm" aria-label={dict.home.trustYears} />
          </fieldset>
          <p className="text-xs text-taupe">{ts.currency}: {salon.currency} · {ts.timezone}: {salon.timezone}</p>
        </Section>

        <div className="space-y-6">
          <Section id="booking" title={ts.booking}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={ts.slotInterval}><input name="slot_interval_minutes" type="number" min={5} max={120} step={5} defaultValue={salon.slot_interval_minutes} className="input-sm" /></Field>
              <Field label={ts.minLead}><input name="min_lead_minutes" type="number" min={0} step={15} defaultValue={salon.min_lead_minutes} className="input-sm" /></Field>
              <Field label={ts.maxAdvance}><input name="max_advance_days" type="number" min={1} max={365} defaultValue={salon.max_advance_days} className="input-sm" /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="auto_confirm" defaultChecked={salon.auto_confirm} className="checkbox" /> {ts.autoConfirm}</label>
            <LocalizedInput name="booking_policy" label={ts.bookingPolicy} value={salon.booking_policy} textarea />
            <p className="pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-mocha">{ts.cancellation}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={ts.cancelWindow}><input name="cancellation_window_hours" type="number" min={0} defaultValue={salon.cancellation_window_hours} className="input-sm" /></Field>
              <Field label={ts.rescheduleWindow}><input name="reschedule_window_hours" type="number" min={0} defaultValue={salon.reschedule_window_hours} className="input-sm" /></Field>
            </div>
            <LocalizedInput name="cancellation_policy" label={ts.cancellationPolicy} value={salon.cancellation_policy} textarea />
          </Section>

          <Section id="notifications" title={ts.notifications}>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify_email" defaultChecked={salon.notify_email} className="checkbox" /> {ts.notifyEmail}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify_whatsapp" defaultChecked={salon.notify_whatsapp} className="checkbox" /> {ts.notifyWhatsapp}</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={ts.reminderHours}><input name="reminder_hours_before" type="number" min={1} max={168} defaultValue={salon.reminder_hours_before} className="input-sm" /></Field>
              <Field label={ts.staffEmail}><input name="staff_notification_email" type="email" defaultValue={salon.staff_notification_email ?? ""} className="input-sm" /></Field>
            </div>
          </Section>

          <Section id="social" title={ts.social}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={ts.instagram}><input name="instagram_url" type="url" defaultValue={salon.instagram_url ?? ""} className="input-sm" /></Field>
              <Field label={ts.instagramHandle}><input name="instagram_handle" defaultValue={salon.instagram_handle ?? ""} className="input-sm" /></Field>
              <Field label={ts.facebook}><input name="facebook_url" type="url" defaultValue={salon.facebook_url ?? ""} className="input-sm" /></Field>
              <Field label={ts.tiktok}><input name="tiktok_url" type="url" defaultValue={salon.tiktok_url ?? ""} className="input-sm" /></Field>
            </div>
          </Section>
        </div>

        <Panel title={ts.team} className="xl:col-span-2">
          <div id="team" className="scroll-mt-20">
            {temp && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-gold bg-cream p-4 text-sm">
                <KeyRound className="mt-0.5 size-5 text-gold-dark" />
                <p>{temp.email} — {ts.tempPassword}: <code className="rounded bg-porcelain px-2 py-0.5 font-mono font-semibold">{temp.temp}</code>
                  <span className="mt-1 block text-xs text-taupe">Shown once. Share it securely; the user can change it under their account.</span></p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-mocha">
                  <tr><th className="py-2">{ts.fullName}</th><th className="py-2">{ts.role}</th><th className="py-2">{ts.linkedEmployee}</th><th className="py-2">{t.common.status}</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5"><span className="font-medium">{u.full_name}</span><span className="block text-xs text-taupe">{u.email}</span></td>
                      <td className="py-2.5">{t.roles[u.role]}</td>
                      <td className="py-2.5">{employees.find((e) => e.id === u.employee_id)?.first_name ?? "—"}</td>
                      <td className="py-2.5"><Badge status={u.is_active ? "confirmed" : "cancelled"} label={u.is_active ? t.common.active : t.common.inactive} /></td>
                      <td className="py-2.5">
                        {u.id !== user.id && (
                          <div className="flex justify-end gap-3">
                            <form action={resetUserPasswordAction}><input type="hidden" name="id" value={u.id} /><SubmitButton className="text-xs font-semibold text-gold-dark hover:underline">{ts.tempPassword}</SubmitButton></form>
                            <form action={toggleUserAction}><input type="hidden" name="id" value={u.id} /><SubmitButton className="text-xs font-semibold text-mocha hover:underline">{u.is_active ? t.common.inactive : t.common.active}</SubmitButton></form>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form action={createUserAction} className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
              <Field label={ts.fullName}><input name="full_name" required className="input-sm" /></Field>
              <Field label={t.common.email}><input name="email" type="email" required className="input-sm" /></Field>
              <Field label={ts.role}>
                <select name="role" defaultValue="staff" className="input-sm">
                  <option value="staff">{t.roles.staff}</option><option value="manager">{t.roles.manager}</option><option value="owner">{t.roles.owner}</option>
                </select>
              </Field>
              <Field label={ts.linkedEmployee}>
                <select name="employee_id" className="input-sm">
                  <option value="">—</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </Field>
              <SubmitButton>{ts.newUser}</SubmitButton>
            </form>
          </div>
        </Panel>
      </div>
    </>
  );
}
