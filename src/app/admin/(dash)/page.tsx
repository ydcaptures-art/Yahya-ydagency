import Link from "next/link";
import { CalendarCheck2, CalendarClock, ListChecks, Wallet, Plus } from "lucide-react";
import { adminContext } from "@/lib/admin";
import { can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fmt } from "@/i18n/dictionaries";
import { localeTags, pick } from "@/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatTime, toDateKey, addDaysKey, zonedToUtc } from "@/lib/time";
import { PageHeader, Panel, Badge, Empty, Flash } from "@/components/admin/ui";
import { RevenueChart } from "@/components/admin/RevenueChart";

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { user, salon, locale, t, dict } = await adminContext();
  const tz = salon.timezone;
  const today = toDateKey(new Date(), tz);
  const dayStart = zonedToUtc(today, "00:00", tz);
  const dayEnd = zonedToUtc(addDaysKey(today, 1), "00:00", tz);
  const scope = user.role === "staff" ? sql`and a.employee_id = ${user.employee_id}` : sql``;
  const showRevenue = can.viewRevenue(user);

  const [todayList, [counts], series, popular] = await Promise.all([
    sql<{ id: string; starts_at: Date; status: string; customer: string; employee: string; services: string[]; branch: string }[]>`
      select a.id, a.starts_at, a.status, c.first_name || ' ' || c.last_name as customer, e.first_name as employee, b.name as branch,
        (select array_agg(s.name_snapshot->>${locale} order by s.position) from appointment_services s where s.appointment_id = a.id) as services
      from appointments a join customers c on c.id = a.customer_id join employees e on e.id = a.employee_id join branches b on b.id = a.branch_id
      where a.salon_id = ${salon.id} and a.starts_at >= ${dayStart} and a.starts_at < ${dayEnd} and a.status <> 'cancelled' ${scope}
      order by a.starts_at`,
    sql<{ upcoming: number; total30: number; revenue30: number; cancelled30: number; noshow30: number; all30: number }[]>`
      select
        count(*) filter (where a.starts_at >= now() and a.starts_at < now() + interval '7 days' and a.status in ('pending','confirmed'))::int as upcoming,
        count(*) filter (where a.created_at >= now() - interval '30 days')::int as total30,
        coalesce(sum(a.total_price_cents) filter (where a.starts_at >= now() - interval '30 days' and a.starts_at < now() and a.status in ('completed','confirmed')), 0)::bigint::float8 as revenue30,
        count(*) filter (where a.starts_at >= now() - interval '30 days' and a.status = 'cancelled')::int as cancelled30,
        count(*) filter (where a.starts_at >= now() - interval '30 days' and a.status = 'no_show')::int as noshow30,
        count(*) filter (where a.starts_at >= now() - interval '30 days')::int as all30
      from appointments a where a.salon_id = ${salon.id} ${scope}`,
    showRevenue
      ? sql<{ day: string; value: number }[]>`
        select to_char(d, 'YYYY-MM-DD') as day, coalesce(sum(a.total_price_cents), 0)::float8 as value
        from generate_series((now() at time zone ${tz})::date - 13, (now() at time zone ${tz})::date, interval '1 day') d
        left join appointments a on a.salon_id = ${salon.id} and (a.starts_at at time zone ${tz})::date = d::date
          and a.status in ('completed', 'confirmed') and a.starts_at < now()
        group by d order by d`
      : Promise.resolve([]),
    sql<{ name: Record<string, string>; n: number }[]>`
      select s.name_snapshot as name, count(*)::int as n from appointment_services s
      join appointments a on a.id = s.appointment_id
      where a.salon_id = ${salon.id} and a.status <> 'cancelled' and a.starts_at >= now() - interval '90 days' ${scope}
      group by s.name_snapshot order by n desc limit 6`,
  ]);

  const o = t.overview;
  const rate = counts.all30 ? Math.round((counts.cancelled30 / counts.all30) * 100) : 0;
  const maxPopular = Math.max(1, ...popular.map((p) => p.n));
  const tiles = [
    { label: o.today, value: String(todayList.length), icon: CalendarCheck2 },
    { label: o.upcoming, value: String(counts.upcoming), icon: CalendarClock },
    { label: o.total, value: String(counts.total30), icon: ListChecks },
    ...(showRevenue ? [{ label: o.revenue, value: formatMoney(Math.round(counts.revenue30), salon.currency, locale), icon: Wallet, hint: o.revenueHint }] : []),
  ];

  return (
    <>
      <Flash error={sp.error === "forbidden" ? t.common.forbidden : undefined} savedText="" />
      <PageHeader
        title={fmt(o.title, { name: user.full_name.split(" ")[0] })}
        subtitle={new Intl.DateTimeFormat(localeTags[locale], { timeZone: tz, dateStyle: "full" }).format(new Date())}
        actions={
          <Link href="/admin/appointments/new" className="btn-primary px-5 py-2.5"><Plus className="size-4" /> {t.appointments.new}</Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-porcelain p-5 shadow-soft">
            <div className="flex items-center justify-between text-mocha">
              <p className="text-xs font-medium">{tile.label}</p>
              <tile.icon className="size-4 text-gold-dark" strokeWidth={1.5} />
            </div>
            <p className="mt-3 font-display text-3xl font-medium sm:text-4xl">{tile.value}</p>
            {"hint" in tile && tile.hint && <p className="mt-1 text-[11px] text-taupe">{tile.hint}</p>}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title={o.todaySchedule} className="xl:col-span-2" actions={<Link href="/admin/calendar" className="text-xs font-semibold text-gold-dark hover:underline">{t.nav.calendar} →</Link>}>
          {todayList.length === 0 ? (
            <Empty>{o.nothingToday}</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {todayList.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/appointments/${a.id}`} className="flex items-center gap-4 py-3 hover:bg-ivory">
                    <span className="w-14 shrink-0 font-display text-xl tabular-nums">{formatTime(a.starts_at, locale, tz)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.customer}</span>
                      <span className="block truncate text-xs text-mocha">{a.services?.join(", ")} · {a.employee} · {a.branch}</span>
                    </span>
                    <Badge status={a.status} label={dict.manage.statuses[a.status as keyof typeof dict.manage.statuses]} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={o.cancellations}>
          <p className="font-display text-4xl">{counts.cancelled30}</p>
          <p className="mt-1 text-sm text-mocha">{fmt(o.cancellationRate, { rate })}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-cream">
            <div className="h-full rounded-full bg-danger/70" style={{ width: `${rate}%` }} />
          </div>
          <p className="mt-5 flex justify-between border-t border-line pt-4 text-sm">
            <span className="text-mocha">{o.noShows}</span>
            <span className="font-semibold">{counts.noshow30}</span>
          </p>
        </Panel>

        {showRevenue && (
          <Panel title={o.revenueChart} className="xl:col-span-2">
            <RevenueChart
              currency={salon.currency}
              locale={localeTags[locale]}
              caption={o.revenueChart}
              data={series.map((s) => ({
                label: s.day.slice(8),
                full: new Intl.DateTimeFormat(localeTags[locale], { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(s.day + "T12:00:00Z")),
                value: s.value,
              }))}
            />
          </Panel>
        )}

        <Panel title={o.popular} className={showRevenue ? "" : "xl:col-span-3"}>
          {popular.length === 0 ? (
            <Empty>{t.common.noResults}</Empty>
          ) : (
            <ul className="space-y-4">
              {popular.map((p) => (
                <li key={JSON.stringify(p.name)}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate">{pick(p.name, locale)}</span>
                    <span className="font-semibold tabular-nums">{p.n}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-cream">
                    <div className="h-full rounded-full bg-[var(--color-chart)]" style={{ width: `${(p.n / maxPopular) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
