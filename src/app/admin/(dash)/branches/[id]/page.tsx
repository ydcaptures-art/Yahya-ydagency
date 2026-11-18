import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { adminPage } from "@/lib/admin";
import { sql } from "@/lib/db";
import { getBranches, getCategories, getServices, getEmployees } from "@/lib/catalog";
import { pick } from "@/i18n/config";
import { formatDateKey } from "@/lib/time";
import { PageHeader, Panel, Flash, Field, LocalizedInput, Empty } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveBranchAction, saveBranchHoursAction, saveBranchServicesAction, addClosureAction, deleteClosureAction } from "../actions";

export default async function BranchEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { salon, locale, t, dict } = await adminPage(["owner", "manager"]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [branches, categories, services, employees] = await Promise.all([
    getBranches(salon.id, false), getCategories(salon.id), getServices(salon.id, false), getEmployees(salon.id, false),
  ]);
  const b = branches.find((x) => x.id === id);
  if (!b) notFound();
  const closures = await sql<{ id: string; date: string; reason: string | null }[]>`
    select id, to_char(date, 'YYYY-MM-DD') as date, reason from branch_closures where branch_id = ${id} and date >= current_date order by date`;
  const tb = t.branches;
  const errors: Record<string, string> = { slug: "Slug already in use", hours: dict.booking.genericError, invalid: dict.booking.genericError };
  const team = employees.filter((e) => e.branch_id === id);

  return (
    <>
      <Link href="/admin/branches" className="mb-4 inline-flex items-center gap-1 text-sm text-mocha hover:text-espresso"><ArrowLeft className="size-4" /> {tb.title}</Link>
      <Flash saved={sp.saved} error={sp.error ? errors[sp.error] : undefined} savedText={t.common.saved} />
      <PageHeader title={b.name} subtitle={`${b.address}, ${b.city}`} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={t.common.edit}>
          <form action={saveBranchAction} className="space-y-3">
            <input type="hidden" name="id" value={b.id} />
            <div className="grid grid-cols-2 gap-2">
              <Field label={t.common.name}><input name="name" defaultValue={b.name} required className="input-sm" /></Field>
              <Field label="Slug"><input name="slug" defaultValue={b.slug} className="input-sm" /></Field>
            </div>
            <Field label={tb.address}><input name="address" defaultValue={b.address} required className="input-sm" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={tb.city}><input name="city" defaultValue={b.city} required className="input-sm" /></Field>
              <Field label={t.common.phone}><input name="phone" defaultValue={b.phone ?? ""} className="input-sm" /></Field>
            </div>
            <Field label={t.common.email}><input name="email" type="email" defaultValue={b.email ?? ""} className="input-sm" /></Field>
            <Field label={tb.mapUrl}><input name="map_url" type="url" defaultValue={b.map_url ?? ""} className="input-sm" /></Field>
            <Field label={tb.image}><input name="image_url" type="url" defaultValue={b.image_url ?? ""} className="input-sm" /></Field>
            <LocalizedInput name="description" label={tb.description} value={b.description} textarea />
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={b.is_active} className="checkbox" /> {t.common.active}</label>
              <label className="flex items-center gap-2 text-sm"># <input name="sort_order" type="number" defaultValue={b.sort_order} className="input-sm w-20" /></label>
            </div>
            <SubmitButton>{t.common.save}</SubmitButton>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel title={tb.openingHours}>
            <form action={saveBranchHoursAction} id="hours" className="scroll-mt-20 space-y-2">
              <input type="hidden" name="id" value={b.id} />
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const h = b.hours.find((x) => x.weekday === d);
                return (
                  <div key={d} className="grid grid-cols-[7rem_1fr_1fr] items-center gap-2 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" name={`open_${d}`} defaultChecked={!!h && !h.is_closed} className="checkbox" /> {dict.hours.days[d]}</label>
                    <input type="time" name={`from_${d}`} defaultValue={h?.open_time ?? "09:00"} className="input-sm" aria-label="open" />
                    <input type="time" name={`to_${d}`} defaultValue={h?.close_time ?? "19:00"} className="input-sm" aria-label="close" />
                  </div>
                );
              })}
              <p className="text-xs text-taupe">☐ = {tb.closed}</p>
              <SubmitButton className="btn-primary px-5 py-2.5">{t.common.save}</SubmitButton>
            </form>
          </Panel>

          <Panel title={tb.closures}>
            <div id="closures" className="scroll-mt-20">
              {closures.length === 0 ? <Empty>—</Empty> : (
                <ul className="divide-y divide-line text-sm">
                  {closures.map((c) => (
                    <li key={c.id} className="flex items-center justify-between py-2">
                      <span>{formatDateKey(c.date, locale, { year: "numeric" })}{c.reason && <span className="text-taupe"> · {c.reason}</span>}</span>
                      <form action={deleteClosureAction}>
                        <input type="hidden" name="id" value={b.id} /><input type="hidden" name="closure_id" value={c.id} />
                        <SubmitButton className="text-taupe hover:text-danger" confirm={t.common.confirmDelete}><Trash2 className="size-4" /></SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <form action={addClosureAction} className="mt-4 grid grid-cols-[auto_1fr_auto] items-end gap-2 border-t border-line pt-4">
                <input type="hidden" name="id" value={b.id} />
                <Field label={t.common.date}><input type="date" name="date" required className="input-sm" /></Field>
                <Field label={t.staff.reason}><input name="reason" className="input-sm" /></Field>
                <SubmitButton className="btn-outline px-4 py-2">{tb.addClosure}</SubmitButton>
              </form>
            </div>
          </Panel>

          <Panel title={t.nav.staff}>
            <ul className="space-y-1 text-sm">
              {team.map((e) => <li key={e.id}><Link href={`/admin/staff/${e.id}`} className="hover:underline">{e.first_name} {e.last_name}</Link> <span className="text-taupe">· {pick(e.title, locale)}</span></li>)}
            </ul>
          </Panel>
        </div>

        <Panel title={t.nav.services} className="xl:col-span-2">
          <form action={saveBranchServicesAction} id="services" className="scroll-mt-20">
            <input type="hidden" name="id" value={b.id} />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => {
                const items = services.filter((s) => s.category_id === c.id);
                if (!items.length) return null;
                return (
                  <fieldset key={c.id}>
                    <legend className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-dark">{pick(c.name, locale)}</legend>
                    {items.map((s) => (
                      <label key={s.id} className="mt-1.5 flex items-center gap-2 text-sm">
                        <input type="checkbox" name="service_ids" value={s.id} defaultChecked={s.branch_ids.includes(b.id)} className="checkbox" /> {pick(s.name, locale)}
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
    </>
  );
}
