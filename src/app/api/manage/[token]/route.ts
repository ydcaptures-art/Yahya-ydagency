import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSalon } from "@/lib/catalog";
import {
  getAppointmentByToken,
  canCustomerChange,
  cancelAppointment,
  rescheduleAppointment,
  SlotUnavailableError,
  PolicyError,
} from "@/lib/booking";
import { notifyAppointment } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("reschedule"), startsAt: z.string().datetime() }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (!rateLimit(`manage:${ip}`, 20, 10 * 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const salon = await getSalon();
  const appt = await getAppointmentByToken(salon.id, token);
  if (!appt) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const kind = parsed.data.action;
  const allowed = canCustomerChange(salon, appt, kind);
  if (!allowed.ok) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  try {
    if (parsed.data.action === "cancel") {
      await cancelAppointment({ salon, appointmentId: appt.id, by: "customer", actor: "customer" });
      const delivered = await notifyAppointment(salon, appt.id, "cancellation").catch(() => []);
      return NextResponse.json({ ok: true, delivered });
    }
    const startsAt = new Date(parsed.data.startsAt);
    // The new time must also respect the policy window
    if ((startsAt.getTime() - Date.now()) / 3600_000 < salon.reschedule_window_hours) {
      return NextResponse.json({ error: "window_passed" }, { status: 403 });
    }
    const result = await rescheduleAppointment({ salon, appointment: appt, startsAt, actor: "customer", isCustomer: true });
    const delivered = await notifyAppointment(salon, appt.id, "reschedule").catch(() => []);
    return NextResponse.json({ ok: true, startsAt: result.startsAt.toISOString(), delivered });
  } catch (err) {
    if (err instanceof SlotUnavailableError) return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
    if (err instanceof PolicyError) return NextResponse.json({ error: err.code }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
