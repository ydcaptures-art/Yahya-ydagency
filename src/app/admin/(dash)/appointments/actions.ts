"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminContext, f } from "@/lib/admin";
import { can, ForbiddenError } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  getAppointment, cancelAppointment, rescheduleAppointment, createBooking, SlotUnavailableError, PolicyError,
} from "@/lib/booking";
import { BookingInputError } from "@/lib/availability";
import { notifyAppointment } from "@/lib/notifications";
import { normalizePhone } from "@/lib/validation";
import { zonedToUtc, isDateKey } from "@/lib/time";
import { isLocale } from "@/i18n/config";

async function loadForUser(id: string) {
  const ctx = await adminContext();
  const appt = await getAppointment(ctx.salon.id, id);
  if (!appt) redirect("/admin/appointments");
  if (!can.manageAllAppointments(ctx.user) && appt.employee.id !== ctx.user.employee_id) throw new ForbiddenError();
  return { ...ctx, appt };
}

export async function setStatusAction(fd: FormData) {
  const id = f.str(fd, "id");
  const status = f.str(fd, "status");
  const { salon, user, appt } = await loadForUser(id);
  const back = `/admin/appointments/${id}`;

  if (status === "cancelled") {
    try {
      await cancelAppointment({ salon, appointmentId: id, by: "salon", actor: user.id, reason: f.opt(fd, "reason", 300) });
    } catch (e) {
      if (e instanceof PolicyError) redirect(`${back}?error=not_active`);
      throw e;
    }
    if (f.bool(fd, "notify")) await notifyAppointment(salon, id, "cancellation").catch(() => undefined);
  } else if (["confirmed", "completed", "no_show"].includes(status)) {
    const allowedFrom: Record<string, string[]> = {
      confirmed: ["pending"],
      completed: ["pending", "confirmed", "no_show"],
      no_show: ["pending", "confirmed"],
    };
    const rows = await sql`update appointments set status = ${status}
      where id = ${id} and salon_id = ${salon.id} and status = any(${allowedFrom[status]}::appointment_status[]) returning id`;
    if (!rows.length) redirect(`${back}?error=not_active`);
    await sql`insert into appointment_events (appointment_id, event, details, actor)
      values (${id}, ${status}, ${sql.json({ from: appt.status })}, ${user.id})`;
    if (status === "confirmed" && appt.status === "pending") {
      await notifyAppointment(salon, id, "confirmation").catch(() => undefined);
    }
  }
  revalidatePath("/admin", "layout");
  redirect(`${back}?saved=1`);
}

export async function rescheduleAction(fd: FormData) {
  const id = f.str(fd, "id");
  const { salon, user, appt } = await loadForUser(id);
  const date = f.str(fd, "date");
  const time = f.time(fd, "time");
  const back = `/admin/appointments/${id}`;
  if (!isDateKey(date) || !time) redirect(`${back}?error=invalid`);
  const employeeRaw = f.str(fd, "employeeId");
  const employeeId = employeeRaw === "any" ? null : employeeRaw || appt.employee.id;
  // Staff may only move their own appointments, and only to themselves
  if (!can.manageAllAppointments(user) && employeeId !== user.employee_id) throw new ForbiddenError();
  try {
    await rescheduleAppointment({
      salon,
      appointment: appt,
      startsAt: zonedToUtc(date, time!, salon.timezone),
      employeeId,
      actor: user.id,
      overrideSchedule: f.bool(fd, "override"),
      isCustomer: false,
    });
  } catch (e) {
    if (e instanceof SlotUnavailableError) redirect(`${back}?error=conflict`);
    if (e instanceof PolicyError) redirect(`${back}?error=not_active`);
    throw e;
  }
  if (f.bool(fd, "notify")) await notifyAppointment(salon, id, "reschedule").catch(() => undefined);
  revalidatePath("/admin", "layout");
  redirect(`${back}?saved=1`);
}

export async function updateNotesAction(fd: FormData) {
  const id = f.str(fd, "id");
  const { salon } = await loadForUser(id);
  await sql`update appointments set internal_notes = ${f.opt(fd, "internal_notes", 2000)} where id = ${id} and salon_id = ${salon.id}`;
  redirect(`/admin/appointments/${id}?saved=1`);
}

export async function createAppointmentAction(fd: FormData) {
  const { salon, user } = await adminContext();
  const back = "/admin/appointments/new";
  const branchId = f.str(fd, "branchId");
  const serviceIds = f.ids(fd, "serviceIds");
  const employeeRaw = f.str(fd, "employeeId");
  let employeeId: string | null = employeeRaw && employeeRaw !== "any" ? employeeRaw : null;
  if (!can.manageAllAppointments(user)) employeeId = user.employee_id; // staff book for themselves
  const date = f.str(fd, "date");
  const time = f.time(fd, "time");
  const phone = normalizePhone(f.str(fd, "phone", 30), salon.phone_country_code);
  const firstName = f.str(fd, "firstName", 80);
  const lastName = f.str(fd, "lastName", 80);
  const email = f.opt(fd, "email", 200)?.toLowerCase() ?? null;
  const localeRaw = f.str(fd, "locale");
  const override = f.bool(fd, "override");

  if (!branchId || !serviceIds.length || !isDateKey(date) || !time || !phone || !firstName || !lastName) {
    redirect(`${back}?error=invalid`);
  }
  if (override && !employeeId) redirect(`${back}?error=invalid`);

  let id: string;
  try {
    const result = await createBooking({
      salon,
      branchId,
      serviceIds,
      employeeId,
      startsAt: zonedToUtc(date, time!, salon.timezone),
      customer: { firstName, lastName, phone: phone!, email },
      customerNotes: null,
      internalNotes: f.opt(fd, "internal_notes", 2000),
      locale: isLocale(localeRaw) ? localeRaw : "tr",
      source: (["admin", "phone", "walk_in"].includes(f.str(fd, "source")) ? f.str(fd, "source") : "admin") as "admin",
      createdBy: user.id,
      overrideSchedule: override,
    });
    id = result.id;
  } catch (e) {
    if (e instanceof SlotUnavailableError) redirect(`${back}?error=conflict`);
    if (e instanceof BookingInputError) redirect(`${back}?error=${e.code}`);
    throw e;
  }
  if (f.bool(fd, "notify")) await notifyAppointment(salon, id, "confirmation").catch(() => undefined);
  revalidatePath("/admin", "layout");
  redirect(`/admin/appointments/${id}?saved=1`);
}
