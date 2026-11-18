import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { adminPage } from "@/lib/admin";
import { sql } from "@/lib/db";
import { getBranches, getCategories, getEmployees, getServices } from "@/lib/catalog";
import { pick } from "@/i18n/config";
import { formatDate, formatTime, toDateKey } from "@/lib/time";
import { PageHeader, Panel, Flash, Field, LocalizedInput, Empty } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveEmployeeAction, saveSkillsAction, saveHoursAction, addTimeOffAction, deleteTimeOffAction, deleteEmployeeAction } from "../actions";

export default async function EmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { salon, locale, t, dict } = await adminPage(["owner", "manager"]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [employees, branches, services, categories] = await Promise.all([
    getEmployees(salon.id, false), getBranches(salon.id, false), getServices(salon.id, false), getCategories(salon.id),
  ]);
  const e = employees.find((x) => x.id === id);
  if (!e) notFound();
  const [rawEmp] = await sql<{ email: string | null; phone: string | null }[]>`select email, phone from employees where id = ${id}`;
  const [hours, timeOff] = await Promise.all([
    sql<{ weekday: number; start_time: string; end_time: string; break_start: string | null; break_end: string | null }[]>`
      select weekday, to_char(start_time,'HH24:MI') as start_time, to_char(end_time,'HH24:MI') as end_time,
        to_char(break_start,'HH24:MI') as break_start, to_char(break_end,'HH24:MI') as break_end
      from employee_working_hours where employee_id = ${id}`,
    sql<{ id: string; starts_at: Date; ends_at: Date; reason: string | null }[]>`
      select id, starts_at, ends_at, reason from employee_time_off where employee_id = ${id} and ends_at > now() order by starts_at`,
  ]);
  const ts = t.staff;
  const branchServiceIds = new Set(services.filter((s) => s.branch_ids.includes(e.branch_id)).map((s) => s.id));
  const errors: Record<string, string> = { has_appointments: ts.hasAppointments, hours: dict.booking.genericError, invalid: dict.booking.genericError };
  const tz = salon.timezone;

  return (
    <>
      <Link href="/admin/staff" className="mb-4 inline-flex items-center gap-1 text-sm text-mocha hover:text-espresso"><ArrowLeft className="size-4" /> {ts.title}</Link>
      <Flash saved={sp.saved} error={sp.error ? errors[sp.error] : undefined} savedText={t.common.saved} />
      <PageHeader title={`${e.first_name} ${e.last_name}`} subtitle={pick(e.title, locale)} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={t.common.edit}>
          <form action={saveEmployeeAction} className="space-y-3">
            <input type="hidden" name="id" value={e.id} />
            <div className="grid grid-cols-2 gap-2">
              <Field label={ts.firstName}><input name="first_name" defaultValue={e.first_name} required className="input-sm" /></Field>
              <Field label={ts.lastName}><input name="last_name" defaultValue={e.last_name} required className="input-sm" /></Field>
            </div>
            <Field label={t.common.branch}>
              <select name="branch_id" defaultValue={e.branch_id} className="input-sm">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t.common.email}><input name="email" type="email" defaultValue={rawEmp.email ?? ""} className="input-sm" /></Field>
              <Field label={t.common.phone}><input name="phone" defaultValue={rawEmp.phone ?? ""} className="input-sm" /></Field>
            </div>
            <LocalizedInput name="title" label={ts.titleField} value={e.title} />
            <LocalizedInput name="bio" label={ts.bio} value={e.bio} textarea />
            <Field label={ts.photo}><input name="photo_url" type="url" defaultValue={e.photo_url ?? ""} className="input-sm" /></Field>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={e.is_active} className="checkbox" /> {t.common.active}</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_bookable" defaultChecked={e.is_bookable} className="checkbox" /> {ts.bookable}</label>
            </div>
            <SubmitButton>{t.common.save}</SubmitButton>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel title={ts.hours}>
            <form action={saveHoursAction} id="hours" className="scroll-mt-20">
              <input type="hidden" name="id" value={e.id} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left text-[11px] text-taupe">
                    <tr><th className="pb-2" /><th className="pb-2">{ts.start}</th><th className="pb-2">{ts.end}</th><th className="pb-2">{ts.breakStart}</th><th className="pb-2">{ts.breakEnd}</th></tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                      const h = hours.find((x) => x.weekday === d);
                      return (
                        <tr key={d}>
                          <td className="py-1 pr-2">
                            <label className="flex items-center gap-2 whitespace-nowrap"><input type="checkbox" name={`on_${d}`} defaultChecked={!!h} className="checkbox" /> {dict.hours.daysShort[d]}</label>
                          </td>
                          <td className="py-1 pr-1"><input type="time" name={`start_${d}`} defaultValue={h?.start_time ?? "10:00"} className="input-sm" /></td>
                          <td className="py-1 pr-1"><input type="time" name={`end_${d}`} defaultValue={h?.end_time ?? "19:00"} className="input-sm" /></td>
                          <td className="py-1 pr-1"><input type="time" name={`bstart_${d}`} defaultValue={h?.break_start ?? ""} className="input-sm" /></td>
                          <td className="py-1"><input type="time" name={`bend_${d}`} defaultValue={h?.break_end ?? ""} className="input-sm" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-taupe">☐ = {ts.dayOff}</p>
              <SubmitButton className="btn-primary mt-4 px-5 py-2.5">{t.common.save}</SubmitButton>
            </form>
          </Panel>

          <Panel title={ts.timeOff}>
            <div id="timeoff" className="scroll-mt-20">
              {timeOff.length === 0 ? <Empty>{ts.noTimeOff}</Empty> : (
                <ul className="divide-y divide-line text-sm">
                  {timeOff.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        {formatDate(o.starts_at, locale, tz, { weekday: "short", year: undefined, month: "short" })} {formatTime(o.starts_at, locale, tz)} → {formatDate(o.ends_at, locale, tz, { weekday: "short", year: undefined, month: "short" })} {formatTime(o.ends_at, locale, tz)}
                        {o.reason && <span className="block text-xs text-taupe">{o.reason}</span>}
                      </span>
                      <form action={deleteTimeOffAction}>
                        <input type="hidden" name="id" value={e.id} /><input type="hidden" name="timeoff_id" value={o.id} />
                        <SubmitButton className="text-taupe hover:text-danger" confirm={t.common.confirmDelete}><Trash2 className="size-4" /></SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <form action={addTimeOffAction} className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4 sm:grid-cols-4">
                <input type="hidden" name="id" value={e.id} />
                <Field label={ts.from}><input type="date" name="from_date" required defaultValue={toDateKey(new Date(), tz)} className="input-sm" /></Field>
                <Field label={t.common.time}><input type="time" name="from_time" className="input-sm" /></Field>
                <Field label={ts.until}><input type="date" name="to_date" className="input-sm" /></Field>
                <Field label={t.common.time}><input type="time" name="to_time" className="input-sm" /></Field>
                <Field label={ts.reason} className="col-span-2 sm:col-span-3"><input name="reason" className="input-sm" /></Field>
                <div className="flex items-end"><SubmitButton className="btn-outline w-full px-4 py-2">{ts.addTimeOff}</SubmitButton></div>
              </form>
            </div>
          </Panel>
        </div>

        <Panel title={ts.skills} className="xl:col-span-2">
          <form action={saveSkillsAction} id="skills" className="scroll-mt-20">
            <input type="hidden" name="id" value={e.id} />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => {
                const items = services.filter((s) => s.category_id === c.id);
                if (!items.length) return null;
                return (
                  <fieldset key={c.id}>
                    <legend className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-dark">{pick(c.name, locale)}</legend>
                    {items.map((s) => (
                      <label key={s.id} className="mt-1.5 flex items-center gap-2 text-sm">
                        <input type="checkbox" name="service_ids" value={s.id} defaultChecked={e.service_ids.includes(s.id)} className="checkbox" />
                        <span className={branchServiceIds.has(s.id) && s.is_active ? "" : "text-taupe line-through"}>{pick(s.name, locale)}</span>
                      </label>
                    ))}
                  </fieldset>
                );
              })}
            </div>
            <SubmitButton className="btn-primary mt-5 px-5 py-2.5">{t.common.save}</SubmitButton>
          </form>
        </Panel>
      </div>

      <form action={deleteEmployeeAction} className="mt-8 text-right">
        <input type="hidden" name="id" value={e.id} />
        <SubmitButton className="btn border border-danger/30 px-4 py-2 text-danger hover:bg-danger/10" confirm={t.common.confirmDelete}>
          <Trash2 className="size-4" /> {t.common.delete}
        </SubmitButton>
      </form>
    </>
  );
}
