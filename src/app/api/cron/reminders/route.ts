import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { getSalon } from "@/lib/catalog";
import { sendDueReminders } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * Sends appointment reminders. Call hourly from a scheduler
 * (Vercel Cron, Supabase pg_cron + pg_net, GitHub Actions, cron-job.org…)
 * with header:  Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const salon = await getSalon();
  const result = await sendDueReminders(salon);
  return NextResponse.json({ ok: true, ...result });
}
