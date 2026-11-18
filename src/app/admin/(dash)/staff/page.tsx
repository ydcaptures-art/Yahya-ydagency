import Link from "next/link";
import { adminPage } from "@/lib/admin";
import { getBranches, getEmployees } from "@/lib/catalog";
import { pick } from "@/i18n/config";
import { PageHeader, Panel, Flash, Field, LocalizedInput, Badge } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { SmartImage } from "@/components/ui/SmartImage";
import { saveEmployeeAction } from "./actions";

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const sp = await searchParams;
  const { salon, locale, t } = await adminPage(["owner", "manager"]);
  const [employees, branches] = await Promise.all([getEmployees(salon.id, false), getBranches(salon.id, false)]);
  const ts = t.staff;
  return (
    <>
      <PageHeader title={ts.title} />
      <Flash saved={sp.saved} savedText={t.common.saved} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {branches.map((b) => (
            <Panel key={b.id} title={b.name}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {employees.filter((e) => e.branch_id === b.id).map((e) => (
                  <li key={e.id}>
                    <Link href={`/admin/staff/${e.id}`} className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:border-gold hover:bg-ivory">
                      <SmartImage src={e.photo_url ?? ""} alt="" fill sizes="48px" wrapperClassName="size-12 shrink-0 rounded-full" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{e.first_name} {e.last_name}</span>
                        <span className="block truncate text-xs text-taupe">{pick(e.title, locale)} · {e.service_ids.length} {t.common.services.toLowerCase()}</span>
                      </span>
                      {!e.is_active ? <Badge status="cancelled" label={t.common.inactive} /> : !e.is_bookable ? <Badge status="pending" label="offline" /> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
        <Panel title={ts.new} className="h-fit">
          <form action={saveEmployeeAction} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label={ts.firstName}><input name="first_name" required className="input-sm" /></Field>
              <Field label={ts.lastName}><input name="last_name" required className="input-sm" /></Field>
            </div>
            <Field label={t.common.branch}>
              <select name="branch_id" className="input-sm">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            </Field>
            <LocalizedInput name="title" label={ts.titleField} />
            <Field label={ts.photo}><input name="photo_url" type="url" placeholder="https://" className="input-sm" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_bookable" defaultChecked className="checkbox" /> {ts.bookable}</label>
            <SubmitButton>{t.common.create}</SubmitButton>
          </form>
        </Panel>
      </div>
    </>
  );
}
