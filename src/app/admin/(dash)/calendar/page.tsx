import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { adminContext } from "@/lib/admin";
import { can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getBranches, getEmployees } from "@/lib/catalog";
import { localeTags } from "@/i18n/config";
import { toDateKey, addDaysKey, zonedToUtc, isDateKey, weekdayOf, timeToMinutes, formatTime } from "@/lib/time";
import { PageHeader } from "@/components/admin/ui";

type Appt = {
  id: string; starts_at: Date; ends_at: Date; status: string; employee_id: string; customer: string; services: string[];
};
type Block = { employee_id: string; starts_at: Date; ends_at: Date; reason: string | null };

const statusBlock: Record<string, string> = {
  pending: "border-warning bg-warning/15",
  confirmed: "border-gold bg-champagne/35",
  completed: "border-success bg-success/12",
  no_show: "border-danger bg-danger/10 opacity-70",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; branch?: string }> }) {
  const sp = await searchParams;
  const { user, salon, locale, t } = await adminContext();
  const tz = salon.timezone;
  const today = toDateKey(new Date(), tz);
  const view = sp.view === "week" || sp.view === "month" ? sp.view : "day";
  const date = sp.date && isDateKey(sp.date) ? sp.date : today;
  const allBranches = await getBranches(salon.id);
  const staffEmployee = user.role === "staff" ? (await getEmployees(salon.id)).find((e) => e.id === user.employee_id) : null;
  const branch = allBranches.find((b) => b.id === (staffEmployee?.branch_id ?? sp.branch)) ?? allBranches[0];
  let employees = (await getEmployees(salon.id)).filter((e) => e.branch_id === branch.id);
  if (!can.manageAllAppointments(user)) employees = employees.filter((e) => e.id === user.employee_id);

  // Range
  let from = date, days = 1;
  if (view === "week") {
    from = addDaysKey(date, -((weekdayOf(date) + 6) % 7));
    days = 7;
  } else if (view === "month") {
    const first = date.slice(0, 8) + "01";
    from = addDaysKey(first, -((weekdayOf(first) + 6) % 7));
    days = 42;
  }
  const start = zonedToUtc(from, "00:00", tz);
  const end = zonedToUtc(addDaysKey(from, days), "00:00", tz);
  const empIds = employees.map((e) => e.id);

  const [appts, blocks] = await Promise.all([
    sql<Appt[]>`
      select a.id, a.starts_at, a.ends_at, a.status, a.employee_id, c.first_name || ' ' || left(c.last_name, 1) || '.' as customer,
        (select array_agg(s.name_snapshot->>${locale} order by s.position) from appointment_services s where s.appointment_id = a.id) as services
      from appointments a join customers c on c.id = a.customer_id
      where a.salon_id = ${salon.id} and a.employee_id = any(${empIds}::uuid[]) and a.status <> 'cancelled'
        and a.starts_at < ${end} and a.ends_at > ${start}
      order by a.starts_at`,
    sql<Block[]>`select employee_id, starts_at, ends_at, reason from employee_time_off
      where employee_id = any(${empIds}::uuid[]) and starts_at < ${end} and ends_at > ${start}`,
  ]);

  // Visible hours = branch opening hours envelope
  const open = Math.min(...branch.hours.filter((h) => !h.is_closed).map((h) => timeToMinutes(h.open_time!)), 9 * 60);
  const close = Math.max(...branch.hours.filter((h) => !h.is_closed).map((h) => timeToMinutes(h.close_time!)), 19 * 60);
  const startHour = Math.floor(open / 60), endHour = Math.ceil(close / 60);
  const hourPx = 64;
  const minutesOfDay = (d: Date) => timeToMinutes(formatTime(d, "en", tz));
  const top = (d: Date) => ((minutesOfDay(d) - startHour * 60) / 60) * hourPx;
  const height = (a: { starts_at: Date; ends_at: Date }) => Math.max(22, ((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 3600000) * hourPx - 2);

  const step = view === "day" ? 1 : view === "week" ? 7 : 0;
  const prev = view === "month" ? addDaysKey(date.slice(0, 8) + "01", -1).slice(0, 8) + "01" : addDaysKey(date, -step);
  const next = view === "month" ? addDaysKey(date.slice(0, 8) + "01", 32).slice(0, 8) + "01" : addDaysKey(date, step);
  const link = (patch: Record<string, string>) => `/admin/calendar?${new URLSearchParams({ view, date, branch: branch.id, ...patch })}`;
  const dayLabel = (k: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(localeTags[locale], { timeZone: "UTC", ...o }).format(new Date(k + "T12:00:00Z"));
  const title =
    view === "month" ? dayLabel(date, { month: "long", year: "numeric" })
    : view === "week" ? `${dayLabel(from, { day: "numeric", month: "short" })} – ${dayLabel(addDaysKey(from, 6), { day: "numeric", month: "short", year: "numeric" })}`
    : dayLabel(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const nowTop = top(new Date());
  const empName = (id: string) => employees.find((e) => e.id === id)?.first_name ?? "";

  const ApptCard = ({ a, compact }: { a: Appt; compact?: boolean }) => (
    <Link
      href={`/admin/appointments/${a.id}`}
      className={clsx("absolute inset-x-0.5 overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-[11px] leading-tight shadow-sm transition hover:z-10 hover:shadow-lift", statusBlock[a.status])}
      style={{ top: top(a.starts_at), height: height(a) }}
      title={`${formatTime(a.starts_at, locale, tz)} ${a.customer} — ${a.services?.join(", ")}`}
    >
      <span className="font-semibold tabular-nums">{formatTime(a.starts_at, locale, tz)}</span> <span className="font-medium">{a.customer}</span>
      {!compact && <span className="block truncate text-mocha">{a.services?.join(", ")}</span>}
    </Link>
  );

  return (
    <>
      <PageHeader
        title={t.nav.calendar}
        actions={<Link href="/admin/appointments/new" className="btn-primary px-5 py-2.5"><Plus className="size-4" /> {t.appointments.new}</Link>}
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border border-line bg-porcelain p-1">
          {(["day", "week", "month"] as const).map((v) => (
            <Link key={v} href={link({ view: v })} className={clsx("rounded-full px-4 py-1.5 text-sm", view === v ? "bg-espresso text-porcelain" : "text-mocha hover:text-espresso")}>
              {t.common[v]}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Link href={link({ date: prev })} className="flex size-9 items-center justify-center rounded-full border border-line bg-porcelain" aria-label={t.common.previous}><ChevronLeft className="size-4" /></Link>
          <Link href={link({ date: today })} className="rounded-full border border-line bg-porcelain px-4 py-1.5 text-sm">{t.common.today}</Link>
          <Link href={link({ date: next })} className="flex size-9 items-center justify-center rounded-full border border-line bg-porcelain" aria-label={t.common.next}><ChevronRight className="size-4" /></Link>
        </div>
        <p className="font-display text-2xl capitalize">{title}</p>
        {can.manageAllAppointments(user) && allBranches.length > 1 && (
          <div className="ml-auto flex gap-1">
            {allBranches.map((b) => (
              <Link key={b.id} href={link({ branch: b.id })} className={clsx("rounded-full px-3 py-1.5 text-sm", b.id === branch.id ? "bg-cream font-semibold" : "text-mocha hover:bg-cream/60")}>{b.name}</Link>
            ))}
          </div>
        )}
      </div>

      {view === "month" ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-porcelain shadow-soft">
          <div className="grid grid-cols-7 border-b border-line bg-cream/50 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-mocha">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => <div key={d} className="py-2">{dayLabel(addDaysKey("2024-01-07", d), { weekday: "short" })}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 42 }, (_, i) => addDaysKey(from, i)).map((k) => {
              const list = appts.filter((a) => toDateKey(a.starts_at, tz) === k);
              const inMonth = k.slice(0, 7) === date.slice(0, 7);
              return (
                <Link key={k} href={link({ view: "day", date: k })} className={clsx("min-h-28 border-r border-b border-line p-2 text-xs hover:bg-ivory", !inMonth && "bg-cream/30 text-taupe")}>
                  <span className={clsx("inline-flex size-6 items-center justify-center rounded-full font-semibold", k === today && "bg-espresso text-porcelain")}>{Number(k.slice(8))}</span>
                  <ul className="mt-1 space-y-0.5">
                    {list.slice(0, 3).map((a) => (
                      <li key={a.id} className="truncate"><span className="tabular-nums text-mocha">{formatTime(a.starts_at, locale, tz)}</span> {a.customer}</li>
                    ))}
                    {list.length > 3 && <li className="font-semibold text-gold-dark">+{list.length - 3}</li>}
                  </ul>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-porcelain shadow-soft">
          {(() => {
            const columns = view === "day"
              ? employees.map((e) => ({ key: e.id, label: `${e.first_name} ${e.last_name}`, date, empIds: [e.id] }))
              : Array.from({ length: 7 }, (_, i) => addDaysKey(from, i)).map((k) => ({ key: k, label: dayLabel(k, { weekday: "short", day: "numeric" }), date: k, empIds }));
            return (
              <div className="grid min-w-[720px]" style={{ gridTemplateColumns: `56px repeat(${Math.max(columns.length, 1)}, minmax(130px, 1fr))` }}>
                <div className="sticky left-0 z-10 border-b border-line bg-porcelain" />
                {columns.map((c) => (
                  <div key={c.key} className={clsx("border-b border-l border-line px-2 py-3 text-center text-xs font-semibold", c.date === today && view === "week" && "bg-cream")}>
                    {view === "week" ? <Link href={link({ view: "day", date: c.date })} className="hover:underline">{c.label}</Link> : c.label}
                  </div>
                ))}
                <div className="sticky left-0 z-10 bg-porcelain">
                  {hours.map((h) => (
                    <div key={h} className="relative border-b border-line/60 text-right" style={{ height: hourPx }}>
                      <span className="absolute -top-2 right-2 text-[10px] text-taupe tabular-nums">{String(h).padStart(2, "0")}:00</span>
                    </div>
                  ))}
                </div>
                {columns.map((c) => {
                  const colAppts = appts.filter((a) => c.empIds.includes(a.employee_id) && toDateKey(a.starts_at, tz) === c.date);
                  const colBlocks = blocks.filter((b) => c.empIds.includes(b.employee_id) && toDateKey(b.starts_at, tz) <= c.date && toDateKey(b.ends_at, tz) >= c.date);
                  const lanes = view === "week" ? Math.max(1, c.empIds.length) : 1;
                  return (
                    <div key={c.key} className="relative border-l border-line" style={{ height: hours.length * hourPx }}>
                      {hours.map((h) => <div key={h} className="border-b border-line/60" style={{ height: hourPx }} />)}
                      {colBlocks.map((b, i) => {
                        const dayStartKey = toDateKey(b.starts_at, tz) < c.date;
                        const dayEndKey = toDateKey(b.ends_at, tz) > c.date;
                        const tTop = dayStartKey ? 0 : top(b.starts_at);
                        const tBottom = dayEndKey ? hours.length * hourPx : top(b.ends_at);
                        return (
                          <div key={i} className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,#efe7dc_0,#efe7dc_6px,transparent_6px,transparent_12px)] px-2 pt-1 text-[10px] text-taupe"
                            style={{ top: Math.max(0, tTop), height: Math.max(16, Math.min(hours.length * hourPx, tBottom) - Math.max(0, tTop)) }}>
                            {view === "week" ? empName(b.employee_id) + " · " : ""}{b.reason}
                          </div>
                        );
                      })}
                      {colAppts.map((a) => {
                        const lane = view === "week" ? Math.max(0, c.empIds.indexOf(a.employee_id)) : 0;
                        return (
                          <div key={a.id} className="absolute inset-y-0" style={{ left: `${(lane / lanes) * 100}%`, width: `${100 / lanes}%` }}>
                            <ApptCard a={a} compact={view === "week"} />
                          </div>
                        );
                      })}
                      {c.date === today && nowTop > 0 && nowTop < hours.length * hourPx && (
                        <div className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-danger/70" style={{ top: nowTop }} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
      {view === "week" && employees.length > 1 && (
        <p className="mt-3 text-xs text-taupe">{employees.map((e) => e.first_name).join(" · ")}</p>
      )}
    </>
  );
}
