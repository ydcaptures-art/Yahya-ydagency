/**
 * Availability engine.
 *
 * A time slot is offered only if at least one eligible professional:
 *  - performs every selected service and works at the selected branch,
 *  - is scheduled to work that weekday (inside branch opening hours),
 *  - is not on a break or blocked time-off,
 *  - has no overlapping active appointment,
 * and the slot respects the salon's minimum notice and maximum advance window.
 *
 * The pure function `computeDaySlots` holds all the rules and is unit-tested;
 * `loadAvailability` fetches the data it needs in a handful of queries.
 * The database exclusion constraint is the final guard against races.
 */
import { timeToMinutes, minutesToTime, weekdayOf, zonedToUtc, addDaysKey, toDateKey } from "./time";

export type Interval = { start: number; end: number }; // epoch ms, [start, end)

export type WorkingHours = {
  weekday: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
};

export type BranchDayHours = { is_closed: boolean; open_time: string | null; close_time: string | null };

export type EmployeeSchedule = {
  id: string;
  hours: WorkingHours[];
  busy: Interval[]; // appointments + time off
};

export type DayInput = {
  dateKey: string;
  timezone: string;
  branchHours: BranchDayHours | undefined;
  branchClosed: boolean; // holiday closure
  durationMinutes: number; // incl. buffers
  intervalMinutes: number;
  earliestStart: number; // epoch ms (now + lead)
  latestDateKey: string; // max advance
  employees: EmployeeSchedule[];
};

export type Slot = { time: string; startsAt: string; available: boolean; employeeIds: string[] };
export type DayAvailability = { date: string; open: boolean; slots: Slot[] };

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export function computeDaySlots(input: DayInput): DayAvailability {
  const { dateKey, timezone, branchHours, durationMinutes, intervalMinutes } = input;
  const result: DayAvailability = { date: dateKey, open: false, slots: [] };
  if (!branchHours || branchHours.is_closed || !branchHours.open_time || !branchHours.close_time) return result;
  if (input.branchClosed || dateKey > input.latestDateKey) return result;

  const open = timeToMinutes(branchHours.open_time);
  const close = timeToMinutes(branchHours.close_time);
  result.open = true;
  const weekday = weekdayOf(dateKey);

  // Per-employee free windows (in minutes from midnight local), before appointments
  const windows = input.employees.map((e) => {
    const wh = e.hours.find((h) => h.weekday === weekday);
    if (!wh) return { e, start: -1, end: -1, brk: null as null | [number, number] };
    return {
      e,
      start: Math.max(open, timeToMinutes(wh.start_time)),
      end: Math.min(close, timeToMinutes(wh.end_time)),
      brk: wh.break_start && wh.break_end ? ([timeToMinutes(wh.break_start), timeToMinutes(wh.break_end)] as [number, number]) : null,
    };
  });

  for (let m = open; m + durationMinutes <= close; m += intervalMinutes) {
    const time = minutesToTime(m);
    const startDate = zonedToUtc(dateKey, time, timezone);
    const slot: Interval = { start: startDate.getTime(), end: startDate.getTime() + durationMinutes * 60_000 };
    const employeeIds: string[] = [];
    if (slot.start >= input.earliestStart) {
      for (const w of windows) {
        if (w.start < 0 || m < w.start || m + durationMinutes > w.end) continue;
        if (w.brk && m < w.brk[1] && w.brk[0] < m + durationMinutes) continue;
        if (w.e.busy.some((b) => overlaps(b, slot))) continue;
        employeeIds.push(w.e.id);
      }
    }
    result.slots.push({ time, startsAt: startDate.toISOString(), available: employeeIds.length > 0, employeeIds });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Data loading (server only)
// ---------------------------------------------------------------------------
export type AvailabilityRequest = {
  salon: { id: string; timezone: string; slot_interval_minutes: number; min_lead_minutes: number; max_advance_days: number };
  branchId: string;
  serviceIds: string[];
  employeeId: string | null;
  fromDate: string;
  days: number;
  excludeAppointmentId?: string;
  /** Admin override: ignore notice period */
  ignoreLeadTime?: boolean;
};

export type AvailabilityResult = {
  durationMinutes: number;
  eligibleEmployeeIds: string[];
  days: DayAvailability[];
};

export class BookingInputError extends Error {
  constructor(public code: "invalid_branch" | "invalid_services" | "invalid_employee" | "no_eligible_employee") {
    super(code);
  }
}

export async function loadAvailability(req: AvailabilityRequest): Promise<AvailabilityResult> {
  const { sql } = await import("./db");
  const { salon, branchId, employeeId } = req;
  const serviceIds = Array.from(new Set(req.serviceIds));

  const [branch] = await sql<{ id: string }[]>`select id from branches where id = ${branchId} and salon_id = ${salon.id} and is_active`;
  if (!branch) throw new BookingInputError("invalid_branch");

  const services = await sql<{ id: string; duration_minutes: number; buffer_minutes: number }[]>`
    select s.id, s.duration_minutes, s.buffer_minutes from services s
    join branch_services bs on bs.service_id = s.id and bs.branch_id = ${branchId}
    where s.salon_id = ${salon.id} and s.is_active and s.id = any(${serviceIds}::uuid[])`;
  if (serviceIds.length === 0 || services.length !== serviceIds.length) throw new BookingInputError("invalid_services");
  const durationMinutes = services.reduce((sum, s) => sum + s.duration_minutes + s.buffer_minutes, 0);

  // Professionals at this branch who perform ALL selected services
  const eligible = await sql<{ id: string }[]>`
    select e.id from employees e
    where e.salon_id = ${salon.id} and e.branch_id = ${branchId} and e.is_active and e.is_bookable
      ${employeeId ? sql`and e.id = ${employeeId}` : sql``}
      and (select count(*) from employee_services es where es.employee_id = e.id and es.service_id = any(${serviceIds}::uuid[])) = ${serviceIds.length}
    order by e.sort_order`;
  if (employeeId && eligible.length === 0) throw new BookingInputError("invalid_employee");
  const eligibleIds = eligible.map((e) => e.id);
  if (eligibleIds.length === 0) return { durationMinutes, eligibleEmployeeIds: [], days: [] };

  const tz = salon.timezone;
  const days = Math.max(1, Math.min(req.days, 62));
  const rangeStart = zonedToUtc(req.fromDate, "00:00", tz);
  const rangeEnd = zonedToUtc(addDaysKey(req.fromDate, days), "00:00", tz);

  const [branchHours, closures, hours, appts, timeOff] = await Promise.all([
    sql<(BranchDayHours & { weekday: number })[]>`select weekday, is_closed, to_char(open_time,'HH24:MI') as open_time,
      to_char(close_time,'HH24:MI') as close_time from branch_hours where branch_id = ${branchId}`,
    sql<{ date: string }[]>`select to_char(date, 'YYYY-MM-DD') as date from branch_closures
      where branch_id = ${branchId} and date >= ${req.fromDate}::date and date < ${req.fromDate}::date + ${days}::int`,
    sql<(WorkingHours & { employee_id: string })[]>`select employee_id, weekday, to_char(start_time,'HH24:MI') as start_time,
      to_char(end_time,'HH24:MI') as end_time, to_char(break_start,'HH24:MI') as break_start, to_char(break_end,'HH24:MI') as break_end
      from employee_working_hours where employee_id = any(${eligibleIds}::uuid[])`,
    sql<{ employee_id: string; starts_at: Date; ends_at: Date }[]>`select employee_id, starts_at, ends_at from appointments
      where employee_id = any(${eligibleIds}::uuid[]) and status in ('pending','confirmed','completed')
        and starts_at < ${rangeEnd} and ends_at > ${rangeStart}
        ${req.excludeAppointmentId ? sql`and id <> ${req.excludeAppointmentId}` : sql``}`,
    sql<{ employee_id: string; starts_at: Date; ends_at: Date }[]>`select employee_id, starts_at, ends_at from employee_time_off
      where employee_id = any(${eligibleIds}::uuid[]) and starts_at < ${rangeEnd} and ends_at > ${rangeStart}`,
  ]);

  const schedules: EmployeeSchedule[] = eligibleIds.map((id) => ({
    id,
    hours: hours.filter((h) => h.employee_id === id),
    busy: [...appts, ...timeOff]
      .filter((a) => a.employee_id === id)
      .map((a) => ({ start: new Date(a.starts_at).getTime(), end: new Date(a.ends_at).getTime() })),
  }));

  const now = Date.now();
  const earliestStart = req.ignoreLeadTime ? now : now + salon.min_lead_minutes * 60_000;
  const todayKey = toDateKey(new Date(now), tz);
  const latestDateKey = addDaysKey(todayKey, salon.max_advance_days);
  const closed = new Set(closures.map((c) => c.date));

  const out: DayAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const dateKey = addDaysKey(req.fromDate, i);
    out.push(
      computeDaySlots({
        dateKey,
        timezone: tz,
        branchHours: branchHours.find((h) => h.weekday === weekdayOf(dateKey)),
        branchClosed: closed.has(dateKey),
        durationMinutes,
        intervalMinutes: salon.slot_interval_minutes,
        earliestStart,
        latestDateKey,
        employees: schedules,
      }),
    );
  }
  return { durationMinutes, eligibleEmployeeIds: eligibleIds, days: out };
}
