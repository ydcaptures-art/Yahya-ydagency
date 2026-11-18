import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { adminPage } from "@/lib/admin";
import { sql } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/time";
import { PageHeader, Panel, Badge, Flash, Field, Empty } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { updateCustomerAction } from "../actions";

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { salon, locale, t, dict } = await adminPage(["owner", "manager"]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [c] = await sql<{ id: string; first_name: string; last_name: string; phone: string; email: string | null; notes: string | null; marketing_opt_in: boolean; created_at: Date; locale: string }[]>`
    select * from customers where id = ${id} and salon_id = ${salon.id}`;
  if (!c) notFound();
  const history = await sql<{ id: string; reference: string; starts_at: Date; status: string; total_price_cents: number; employee: string; branch: string; services: string[] }[]>`
    select a.id, a.reference, a.starts_at, a.status, a.total_price_cents, e.first_name as employee, b.name as branch,
      (select array_agg(s.name_snapshot->>${locale} order by s.position) from appointment_services s where s.appointment_id = a.id) as services
    from appointments a join employees e on e.id = a.employee_id join branches b on b.id = a.branch_id
    where a.customer_id = ${id} order by a.starts_at desc`;
  const tc = t.customers;
  const spent = history.filter((h) => h.status === "completed").reduce((s, h) => s + h.total_price_cents, 0);
  return (
    <>
      <Link href="/admin/customers" className="mb-4 inline-flex items-center gap-1 text-sm text-mocha hover:text-espresso"><ArrowLeft className="size-4" /> {tc.title}</Link>
      <Flash saved={sp.saved} error={sp.error ? dict.booking.invalidPhone : undefined} savedText={t.common.saved} />
      <PageHeader title={`${c.first_name} ${c.last_name}`} subtitle={`${tc.since} ${formatDate(c.created_at, locale, salon.timezone, { weekday: undefined })} · ${tc.visits}: ${history.filter((h) => h.status === "completed").length} · ${tc.totalSpent}: ${formatMoney(spent, salon.currency, locale)}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t.common.customer}>
          <form action={updateCustomerAction} className="space-y-3">
            <input type="hidden" name="id" value={c.id} />
            <div className="grid grid-cols-2 gap-2">
              <Field label={dict.booking.firstName}><input name="first_name" defaultValue={c.first_name} required className="input-sm" /></Field>
              <Field label={dict.booking.lastName}><input name="last_name" defaultValue={c.last_name} required className="input-sm" /></Field>
            </div>
            <Field label={t.common.phone}><input name="phone" defaultValue={c.phone} required className="input-sm" /></Field>
            <Field label={t.common.email}><input name="email" type="email" defaultValue={c.email ?? ""} className="input-sm" /></Field>
            <Field label={t.common.notes} hint={tc.notesHint}><textarea name="notes" rows={5} defaultValue={c.notes ?? ""} className="input-sm" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="marketing_opt_in" defaultChecked={c.marketing_opt_in} className="checkbox" /> {tc.marketing}</label>
            <SubmitButton>{t.common.save}</SubmitButton>
          </form>
        </Panel>
        <Panel title={tc.history} className="lg:col-span-2">
          {history.length === 0 ? <Empty>{t.common.noResults}</Empty> : (
            <ul className="divide-y divide-line">
              {history.map((h) => (
                <li key={h.id}>
                  <Link href={`/admin/appointments/${h.id}`} className="flex items-center gap-4 py-3 hover:bg-ivory">
                    <span className="w-40 shrink-0 text-sm">{formatDate(h.starts_at, locale, salon.timezone, { weekday: "short", month: "short" })}<span className="block text-xs text-taupe">{formatTime(h.starts_at, locale, salon.timezone)} · {h.branch}</span></span>
                    <span className="min-w-0 flex-1 truncate text-sm">{h.services?.join(", ")} <span className="text-taupe">· {h.employee}</span></span>
                    <span className="text-sm tabular-nums">{formatMoney(h.total_price_cents, salon.currency, locale)}</span>
                    <Badge status={h.status} label={dict.manage.statuses[h.status as keyof typeof dict.manage.statuses]} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
