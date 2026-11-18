import { NextResponse, type NextRequest } from "next/server";
import { getSalon } from "@/lib/catalog";
import { createBooking, getAppointment, SlotUnavailableError } from "@/lib/booking";
import { BookingInputError } from "@/lib/availability";
import { bookingRequestSchema, normalizePhone } from "@/lib/validation";
import { notifyAppointment, siteUrl } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (!rateLimit(`book:${ip}`, Number(process.env.BOOKING_RATE_LIMIT ?? 10), 10 * 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;
  const salon = await getSalon();
  const phone = normalizePhone(data.customer.phone, salon.phone_country_code);
  if (!phone) return NextResponse.json({ error: "validation", fields: { phone: ["invalid"] } }, { status: 400 });

  try {
    const booking = await createBooking({
      salon,
      branchId: data.branchId,
      serviceIds: data.serviceIds,
      employeeId: data.employeeId,
      startsAt: new Date(data.startsAt),
      customer: { firstName: data.customer.firstName, lastName: data.customer.lastName, phone, email: data.customer.email },
      customerNotes: data.customer.notes,
      locale: data.locale,
      source: "online",
    });

    // Notifications never block or fail the booking; we report what was really delivered.
    const delivered = await notifyAppointment(salon, booking.id, "confirmation").catch((e) => {
      console.error("notification error", e);
      return [] as string[];
    });

    const appt = await getAppointment(salon.id, booking.id);
    return NextResponse.json({
      reference: booking.reference,
      status: booking.status,
      manageUrl: `${siteUrl()}/${data.locale}/booking/manage/${booking.manage_token}`,
      managePath: `/${data.locale}/booking/manage/${booking.manage_token}`,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      employee: appt ? { firstName: appt.employee.first_name, lastName: appt.employee.last_name } : null,
      delivered,
    });
  } catch (err) {
    if (err instanceof SlotUnavailableError) return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
    if (err instanceof BookingInputError) return NextResponse.json({ error: err.code }, { status: 400 });
    console.error("booking error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
