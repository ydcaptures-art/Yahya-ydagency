import Link from "next/link";
import { Search } from "lucide-react";
import { adminPage } from "@/lib/admin";
import { sql } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { PageHeader, Empty } from "@/components/admin/ui";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const { salon, locale, t } = await adminPage(["owner", "manager"]);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const digits = q.replace(/\D/g, "");
  const page = Math.max(1, Number(sp.page) || 1);
  const rows = await sql<{ id: string; name: string; phone: string; email: string | null; visits: number; spent: number; last_visit: Date | null }[]>`
    select c.id, c.first_name || ' ' || c.last_name as name, c.phone, c.email,
      count(a.id) filter (where a.status = 'completed')::int as visits,
      coalesce(sum(a.total_price_cents) filter (where a.status = 'completed'), 0)::float8 as spent,
      max(a.starts_at) filter (where a.status in ('completed','confirmed') and a.starts_at < now()) as last_visit
    from customers c left join appointments a on a.customer_id = c.id
    where c.salon_id = ${salon.id}
      ${q ? sql`and (c.first_name || ' ' || c.last_name ilike ${like} or c.email ilike ${like}
        ${digits.length >= 4 ? sql`or regexp_replace(c.phone, '\\D', '', 'g') like ${"%" + digits + "%"}` : sql``})` : sql``}
    group by c.id order by max(a.created_at) desc nulls last, c.created_at desc
    limit 51 offset ${(page - 1) * 50}`;
  const tc = t.customers;
  return (
    <>
      <PageHeader title={tc.title} />
      <form className="mb-6 flex gap-2" role="search">
        <label className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-taupe" />
          <input name="q" defaultValue={q} placeholder={tc.searchPlaceholder} className="input-sm pl-9" />
        </label>
        <button className="btn-outline px-5 py-2">{t.common.search}</button>
      </form>
      {rows.length === 0 ? <Empty>{t.common.noResults}</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-porcelain shadow-soft">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-cream/60 text-left text-[11px] uppercase tracking-[0.12em] text-mocha">
              <tr><th className="px-4 py-3">{t.common.name}</th><th className="px-4 py-3">{t.common.phone}</th><th className="px-4 py-3">{tc.visits}</th><th className="px-4 py-3">{tc.lastVisit}</th><th className="px-4 py-3 text-right">{tc.totalSpent}</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.slice(0, 50).map((c) => (
                <tr key={c.id} className="hover:bg-ivory">
                  <td className="px-4 py-3"><Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline">{c.name}</Link><span className="block text-xs text-taupe">{c.email}</span></td>
                  <td className="px-4 py-3 tabular-nums">{c.phone}</td>
                  <td className="px-4 py-3">{c.visits}</td>
                  <td className="px-4 py-3">{c.last_visit ? formatDate(c.last_visit, locale, salon.timezone, { weekday: undefined }) : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(Math.round(c.spent), salon.currency, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link href={`?q=${encodeURIComponent(q)}&page=${page - 1}`} className="text-gold-dark">← {t.common.previous}</Link> : <span />}
        {rows.length > 50 && <Link href={`?q=${encodeURIComponent(q)}&page=${page + 1}`} className="text-gold-dark">{t.common.next} →</Link>}
      </div>
    </>
  );
}
