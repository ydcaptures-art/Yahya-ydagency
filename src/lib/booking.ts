import "server-only";
import { randomInt } from "crypto";
import { sql, isExclusionViolation, isUniqueViolation } from "./db";
import { loadAvailability, BookingInputError } from "./availability";
import type { Salon } from "./catalog";
import { toDateKey } from "./time";
import type { Locale, Localized } from "@/i18n/config";

export class SlotUnavailableError extends Error {
  constructor() {
    super("slot_unavailable");
  }
}
export class PolicyError extends Error {
  constructor(public code: "window_passed" | "not_active" | "in_past") {
    super(code);
  }
}

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeReference(salonName: string): string {
  const prefix = salonName.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "YD";
  let body = "";
  for (let i = 0; i < 6; i++) body += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `${prefix}-${body}`;
}

export type CreateBookingInput = {
  salon: Salon;
  branchId: string;
  serviceIds: string[];
  employeeId: string | null;
  startsAt: Date;
  customer: { firstName: string; lastName: string; phone: string; email?: string | null };
  customerNotes?: string | null;
  internalNotes?: string | null;
  locale: Locale;
  source: "online" | "admin" | "phone" | "walk_in";
  createdBy?: string | null;
  /** Admin only: allow times outside working hours / notice period (overlaps are still impossible). */
  overrideSchedule?: boolean;
};

type ServiceRow = { id: string; name: Localized; price_cents: number; duration_minutes: number; buffer_minutes: number };

/**
 * Creates an appointment. Availability is re-validated on the server, then the
 * insert is protected by the `appointments_no_overlap` exclusion constraint, so
 * two customers can never get the same professional at the same time — even
 * when they submit in the same millisecond.
 */
export async function createBooking(input: CreateBookingInput) {
  const { salon } = input;
  const serviceIds = Array.from(new Set(input.serviceIds));

  const services = await sql<ServiceRow[]>`
    select s.id, s.name, s.price_cents, s.duration_minutes, s.buffer_minutes from services s
    join branch_services bs on bs.service_id = s.id and bs.branch_id = ${input.branchId}
    where s.salon_id = ${salon.id} and s.is_active and s.id = any(${serviceIds}::uuid[])`;
  if (services.length !== serviceIds.length) throw new BookingInputError("invalid_services");
  // Keep the order the customer chose
  services.sort((a, b) => serviceIds.indexOf(a.id) - serviceIds.indexOf(b.id));

  const totalMinutes = services.reduce((s, x) => s + x.duration_minutes + x.buffer_minutes, 0);
  const visibleMinutes = services.reduce((s, x) => s + x.duration_minutes, 0);
  const totalPrice = services.reduce((s, x) => s + x.price_cents, 0);
  const startsAt = input.startsAt;
  const endsAt = new Date(startsAt.getTime() + totalMinutes * 60_000);

  // Which professionals can take this exact slot?
  let candidates: string[];
  if (input.overrideSchedule && input.employeeId) {
    candidates = [input.employeeId];
    const ok = await sql`select 1 from employees where id = ${input.employeeId} and salon_id = ${salon.id} and branch_id = ${input.branchId}`;
    if (!ok.length) throw new BookingInputError("invalid_employee");
  } else {
    const dateKey = toDateKey(startsAt, salon.timezone);
    const avail = await loadAvailability({
      salon,
      branchId: input.branchId,
      serviceIds,
      employeeId: input.employeeId,
      fromDate: dateKey,
      days: 1,
      ignoreLeadTime: input.source !== "online",
    });
    if (avail.eligibleEmployeeIds.length === 0) throw new BookingInputError("no_eligible_employee");
    const slot = avail.days[0]?.slots.find((s) => new Date(s.startsAt).getTime() === startsAt.getTime());
    if (!slot || !slot.available) throw new SlotUnavailableError();
    candidates = slot.employeeIds;
    if (!input.employeeId && candidates.length > 1) {
      // Balance the workload: prefer whoever has the fewest bookings that day
      const load = await sql<{ employee_id: string; n: number }[]>`
        select employee_id, count(*)::int as n from appointments
        where employee_id = any(${candidates}::uuid[]) and status in ('pending','confirmed')
          and starts_at >= ${new Date(startsAt.getTime() - 12 * 3600_000)} and starts_at < ${new Date(startsAt.getTime() + 12 * 3600_000)}
        group by employee_id`;
      const n = (id: string) => load.find((l) => l.employee_id === id)?.n ?? 0;
      candidates = [...candidates].sort((a, b) => n(a) - n(b));
    }
  }

  const status = input.source === "online" && !salon.auto_confirm ? "pending" : "confirmed";

  for (const employeeId of candidates) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const appointment = await sql.begin(async (tx) => {
          const [customer] = await tx<{ id: string }[]>`
            insert into customers (salon_id, first_name, last_name, phone, email, locale)
            values (${salon.id}, ${input.customer.firstName}, ${input.customer.lastName}, ${input.customer.phone},
                    ${input.customer.email || null}, ${input.locale})
            on conflict (salon_id, phone) do update set
              first_name = excluded.first_name,
              last_name = excluded.last_name,
              email = coalesce(excluded.email, customers.email),
              locale = excluded.locale
            returning id`;
          const [appt] = await tx<{ id: string; reference: string; manage_token: string }[]>`
            insert into appointments (salon_id, branch_id, employee_id, customer_id, reference, starts_at, ends_at, status,
              total_price_cents, total_duration_minutes, customer_notes, internal_notes, source, locale,
              employee_was_requested, created_by)
            values (${salon.id}, ${input.branchId}, ${employeeId}, ${customer.id}, ${makeReference(salon.name)},
              ${startsAt}, ${endsAt}, ${status}, ${totalPrice}, ${visibleMinutes}, ${input.customerNotes || null},
              ${input.internalNotes || null}, ${input.source}, ${input.locale}, ${!!input.employeeId}, ${input.createdBy || null})
            returning id, reference, manage_token`;
          for (const [i, s] of services.entries()) {
            await tx`insert into appointment_services (appointment_id, service_id, position, name_snapshot, price_cents, duration_minutes)
              values (${appt.id}, ${s.id}, ${i}, ${sql.json(s.name)}, ${s.price_cents}, ${s.duration_minutes})`;
          }
          await tx`insert into appointment_events (appointment_id, event, details, actor)
            values (${appt.id}, 'created', ${sql.json({ source: input.source, status })}, ${input.createdBy || "customer"})`;
          return appt;
        });
        return { ...appointment, employeeId, startsAt, endsAt, status };
      } catch (err) {
        if (isExclusionViolation(err)) break; // this professional just got booked — try the next one
        if (isUniqueViolation(err) && String((err as Error).message).includes("reference")) continue; // retry reference
        throw err;
      }
    }
  }
  throw new SlotUnavailableError();
}

// ---------------------------------------------------------------------------
// Reading appointments
// ---------------------------------------------------------------------------
export type AppointmentDetails = {
  id: string;
  reference: string;
  manage_token: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  starts_at: Date;
  ends_at: Date;
  total_price_cents: number;
  total_duration_minutes: number;
  customer_notes: string | null;
  internal_notes: string | null;
  source: string;
  locale: Locale;
  employee_was_requested: boolean;
  cancel_reason: string | null;
  created_at: Date;
  branch: { id: string; name: string; address: string; city: string; phone: string | null; map_url: string | null };
  employee: { id: string; first_name: string; last_name: string; title: Localized; photo_url: string | null };
  customer: { id: string; first_name: string; last_name: string; phone: string; email: string | null; locale: Locale };
  services: { service_id: string | null; name: Localized; price_cents: number; duration_minutes: number }[];
};

const detailsQuery = (where: ReturnType<typeof sql>) => sql<AppointmentDetails[]>`
  select a.id, a.reference, a.manage_token, a.status, a.starts_at, a.ends_at, a.total_price_cents, a.total_duration_minutes,
    a.customer_notes, a.internal_notes, a.source, a.locale, a.employee_was_requested, a.cancel_reason, a.created_at,
    json_build_object('id', b.id, 'name', b.name, 'address', b.address, 'city', b.city, 'phone', b.phone, 'map_url', b.map_url) as branch,
    json_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name, 'title', e.title, 'photo_url', e.photo_url) as employee,
    json_build_object('id', c.id, 'first_name', c.first_name, 'last_name', c.last_name, 'phone', c.phone, 'email', c.email, 'locale', c.locale) as customer,
    (select json_agg(json_build_object('service_id', s.service_id, 'name', s.name_snapshot, 'price_cents', s.price_cents,
       'duration_minutes', s.duration_minutes) order by s.position) from appointment_services s where s.appointment_id = a.id) as services
  from appointments a
  join branches b on b.id = a.branch_id
  join employees e on e.id = a.employee_id
  join customers c on c.id = a.customer_id
  ${where}`;

export async function getAppointment(salonId: string, id: string) {
  const rows = await detailsQuery(sql`where a.salon_id = ${salonId} and a.id = ${id}`);
  return rows[0] ?? null;
}

export async function getAppointmentByToken(salonId: string, token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const rows = await detailsQuery(sql`where a.salon_id = ${salonId} and a.manage_token = ${token}`);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Customer self-service: cancel / reschedule (subject to salon policy)
// ---------------------------------------------------------------------------
export function canCustomerChange(salon: Salon, appt: Pick<AppointmentDetails, "status" | "starts_at">, kind: "cancel" | "reschedule") {
  if (appt.status !== "confirmed" && appt.status !== "pending") return { ok: false as const, reason: "not_active" as const };
  const hoursLeft = (new Date(appt.starts_at).getTime() - Date.now()) / 3600_000;
  if (hoursLeft <= 0) return { ok: false as const, reason: "in_past" as const };
  const windowHours = kind === "cancel" ? salon.cancellation_window_hours : salon.reschedule_window_hours;
  if (hoursLeft < windowHours) return { ok: false as const, reason: "window_passed" as const };
  return { ok: true as const };
}

export async function cancelAppointment(opts: {
  salon: Salon;
  appointmentId: string;
  by: "customer" | "salon";
  actor: string;
  reason?: string | null;
}) {
  const rows = await sql<{ id: string }[]>`
    update appointments set status = 'cancelled', cancelled_at = now(), cancelled_by = ${opts.by}, cancel_reason = ${opts.reason || null}
    where id = ${opts.appointmentId} and salon_id = ${opts.salon.id} and status in ('pending', 'confirmed')
    returning id`;
  if (!rows.length) throw new PolicyError("not_active");
  await sql`insert into appointment_events (appointment_id, event, details, actor)
    values (${opts.appointmentId}, 'cancelled', ${sql.json({ by: opts.by, reason: opts.reason ?? null })}, ${opts.actor})`;
}

/**
 * Moves an appointment to a new start time (and optionally another professional).
 * Same validation as a new booking; the exclusion constraint guards the update.
 */
export async function rescheduleAppointment(opts: {
  salon: Salon;
  appointment: AppointmentDetails;
  startsAt: Date;
  employeeId?: string | null; // null/undefined = keep requested pro, or any if none was requested
  actor: string;
  overrideSchedule?: boolean;
  isCustomer: boolean;
}) {
  const { salon, appointment: a } = opts;
  const serviceIds = a.services.map((s) => s.service_id).filter((x): x is string => !!x);
  const [dur] = await sql<{ minutes: number }[]>`
    select coalesce(sum(s.duration_minutes + s.buffer_minutes), 0)::int as minutes from services s where s.id = any(${serviceIds}::uuid[])`;
  const totalMinutes = Math.max(dur.minutes, a.total_duration_minutes);
  const endsAt = new Date(opts.startsAt.getTime() + totalMinutes * 60_000);

  const requested = opts.employeeId !== undefined ? opts.employeeId : a.employee_was_requested ? a.employee.id : null;
  let candidates: string[];
  if (opts.overrideSchedule && requested) {
    candidates = [requested];
  } else {
    const avail = await loadAvailability({
      salon,
      branchId: a.branch.id,
      serviceIds,
      employeeId: requested,
      fromDate: toDateKey(opts.startsAt, salon.timezone),
      days: 1,
      excludeAppointmentId: a.id,
      ignoreLeadTime: !opts.isCustomer,
    });
    const slot = avail.days[0]?.slots.find((s) => new Date(s.startsAt).getTime() === opts.startsAt.getTime());
    if (!slot || !slot.available) throw new SlotUnavailableError();
    // Prefer keeping the same professional when possible
    candidates = [...slot.employeeIds].sort((x, y) => (x === a.employee.id ? -1 : y === a.employee.id ? 1 : 0));
  }

  for (const employeeId of candidates) {
    try {
      const rows = await sql<{ id: string }[]>`
        update appointments set starts_at = ${opts.startsAt}, ends_at = ${endsAt}, employee_id = ${employeeId}
        where id = ${a.id} and salon_id = ${salon.id} and status in ('pending', 'confirmed') returning id`;
      if (!rows.length) throw new PolicyError("not_active");
      await sql`insert into appointment_events (appointment_id, event, details, actor)
        values (${a.id}, 'rescheduled', ${sql.json({ from: new Date(a.starts_at).toISOString(), to: opts.startsAt.toISOString(), employeeId })}, ${opts.actor})`;
      return { employeeId, startsAt: opts.startsAt, endsAt };
    } catch (err) {
      if (isExclusionViolation(err)) continue;
      throw err;
    }
  }
  throw new SlotUnavailableError();
}
