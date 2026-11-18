import { NextResponse, type NextRequest } from "next/server";
import { getSalon } from "@/lib/catalog";
import { loadAvailability, BookingInputError } from "@/lib/availability";
import { getAppointmentByToken } from "@/lib/booking";
import { availabilityQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const parsed = availabilityQuerySchema.safeParse({
    branchId: q.get("branchId"),
    serviceIds: q.getAll("serviceId"),
    employeeId: q.get("employeeId") || null,
    from: q.get("from"),
    days: q.get("days") ?? 1,
    excludeToken: q.get("token") || undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const salon = await getSalon();
  try {
    let excludeAppointmentId: string | undefined;
    if (parsed.data.excludeToken) {
      excludeAppointmentId = (await getAppointmentByToken(salon.id, parsed.data.excludeToken))?.id;
    }
    const result = await loadAvailability({
      salon,
      branchId: parsed.data.branchId,
      serviceIds: parsed.data.serviceIds,
      employeeId: parsed.data.employeeId ?? null,
      fromDate: parsed.data.from,
      days: parsed.data.days,
      excludeAppointmentId,
    });
    // Do not expose which professional is free at which time
    return NextResponse.json(
      {
        durationMinutes: result.durationMinutes,
        hasEligibleProfessional: result.eligibleEmployeeIds.length > 0,
        days: result.days.map((d) => ({
          date: d.date,
          open: d.open,
          slots: d.slots.map((s) => ({ time: s.time, startsAt: s.startsAt, available: s.available })),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof BookingInputError) return NextResponse.json({ error: err.code }, { status: 400 });
    throw err;
  }
}
