import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { adminContext } from "@/lib/admin";
import { can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getBranches } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/time";
import { PageHeader, Badge, Empty } from "@/components/admin/ui";

const STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; branch?: string; range?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const { user, salon, locale, t, dict } = await adminContext();
  const branches = await getBranches(salon.id, false);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const status = STATUSES.includes(sp.status as never) ? sp.status! : "";
  const branch = branches.some((b) => b.id === sp.branch) ? sp.branch! : "";
  const range = sp.range === "past" || sp.range === "all" ? sp.range : "upcoming";
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = 50;
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const digits = q.replace(/\D/g, "");

  const rows = await sql<{
    id: string; reference: string; starts_at: Date; status: string; total_price_cents: number; source: string;
    customer: string; phone: string; employee: string; branch: string; services: string[];
  }[]>`
    select a.id, a.reference, a.starts_at, a.status, a.total_price_cents, a.source,
      c.first_name || ' ' || c.last_name as customer, c.phone, e.first_name || ' ' || e.last_name as employee, b.name as branch,
      (select array_agg(s.name_snapshot->>${locale} order by s.position) from appointment_services s where s.appointment_id = a.id) as services
    from appointments a
    join customers c on c.id = a.customer_id
    join employees e on e.id = a.employee_id
    join branches b on b.id = a.branch_id
    where a.salon_id = ${salon.id}
      ${user.role === "staff" ? sql`and a.employee_id = ${user.employee_id}` : sql``}
      ${status ? sql`and a.status = ${status}` : sql``}
      ${branch ? sql`and a.branch_id = ${branch}` : sql``}
      ${range === "upcoming" ? sql`and a.ends_at >= now()` : range === "past" ? sql`and a.ends_at < now()` : sql``}
      ${q ? sql`and (c.first_name || ' ' || c.last_name ilike ${like} or a.reference ilike ${like}
              ${digits.length >= 4 ? sql`or regexp_replace(c.phone, '\\D', '', 'g') like ${"%" + digits + "%"}` : sql``})` : sql``}
    order by a.starts_at ${range === "upcoming" ? sql`asc` : sql`desc`}
    limit ${limit + 1} offset ${(page - 1) * limit}`;
  const hasMore = rows.length > limit;
  const list = rows.slice(0, limit);
  const ta = t.appointments;
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(status && { status }), ...(branch && { branch }), range, ...patch });
    return `/admin/appointments?${p}`;
  };

  return (
    <>
      <PageHeader title={ta.title} actions={<Link href="/admin/appointments/new" className="btn-primary px-5 py-2.5"><Plus className="size-4" /> {ta.new}</Link>} />

      <form className="mb-6 grid gap-3 rounded-2xl border border-line bg-porcelain p-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]" role="search">
        <label className="relative">
          <span className="sr-only">{t.common.search}</span>
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-taupe" />
          <input name="q" defaultValue={q} placeholder={ta.searchPlaceholder} className="input-sm pl-9" />
        </label>
        <select name="range" defaultValue={range} className="input-sm" aria-label={t.common.date}>
          <option value="upcoming">{ta.upcoming}</option>
          <option value="past">{ta.past}</option>
          <option value="all">{t.common.all}</option>
        </select>
        <select name="status" defaultValue={status} className="input-sm" aria-label={t.common.status}>
          <option value="">{t.common.status}: {t.common.all}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{dict.manage.statuses[s]}</option>)}
        </select>
        {can.manageAllAppointments(user) && (
          <select name="branch" defaultValue={branch} className="input-sm" aria-label={t.common.branch}>
            <option value="">{t.common.branch}: {t.common.all}</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <button className="btn-outline px-5 py-2">{t.common.search}</button>
      </form>

      {list.length === 0 ? (
        <Empty>{t.common.noResults}</Empty>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-porcelain shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-cream/60 text-left text-[11px] uppercase tracking-[0.12em] text-mocha">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t.common.date}</th>
                  <th className="px-4 py-3 font-semibold">{t.common.customer}</th>
                  <th className="px-4 py-3 font-semibold">{t.common.services}</th>
                  <th className="px-4 py-3 font-semibold">{t.common.employee}</th>
                  <th className="px-4 py-3 font-semibold">{t.common.status}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t.common.price}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((a) => (
                  <tr key={a.id} className="hover:bg-ivory">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/admin/appointments/${a.id}`} className="font-medium hover:underline">
                        {formatDate(a.starts_at, locale, salon.timezone, { weekday: "short", month: "short", year: undefined })} · {formatTime(a.starts_at, locale, salon.timezone)}
                      </Link>
                      <span className="block text-[11px] text-taupe">{a.reference} · {a.branch}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{a.customer}</span>
                      <span className="block text-xs text-taupe">{a.phone}</span>
                    </td>
                    <td className="max-w-[16rem] truncate px-4 py-3 text-mocha">{a.services?.join(", ")}</td>
                    <td className="px-4 py-3">{a.employee}</td>
                    <td className="px-4 py-3"><Badge status={a.status} label={dict.manage.statuses[a.status as keyof typeof dict.manage.statuses]} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(a.total_price_cents, salon.currency, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="text-gold-dark hover:underline">← {t.common.previous}</Link> : <span />}
        {hasMore && <Link href={qs({ page: String(page + 1) })} className="text-gold-dark hover:underline">{t.common.next} →</Link>}
      </div>
    </>
  );
}
