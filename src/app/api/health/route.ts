import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSalon, getBranches } from "@/lib/catalog";

export const dynamic = "force-dynamic";

/** Diagnostic: times each database step (each limited to 8s). */
export async function GET() {
  const steps: Record<string, string> = {};
  const run = async (name: string, fn: () => Promise<unknown>) => {
    const t0 = Date.now();
    try {
      const v = await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT 8s")), 8000))]);
      steps[name] = `ok ${Date.now() - t0}ms ${JSON.stringify(v)?.slice(0, 60)}`;
    } catch (e) {
      steps[name] = `FAIL ${Date.now() - t0}ms ${(e as Error).message}`;
    }
  };
  await run("select1", async () => (await sql`select 1 as x`)[0]);
  await run("salons", async () => (await sql`select count(*)::int as n from salons`)[0]);
  await run("branches_plain", async () => (await sql`select count(*)::int as n from branches`)[0]);
  await run("branch_hours", async () => (await sql`select count(*)::int as n from branch_hours`)[0]);
  await run("getSalon", async () => (await getSalon()).slug);
  const salon = await getSalon().catch(() => null);
  if (salon) await run("getBranches", async () => (await getBranches(salon.id)).length);
  await run("parallel3", async () => Promise.all([sql`select 1`, sql`select 2`, sql`select 3`]).then((r) => r.length));
  return NextResponse.json({ region: process.env.VERCEL_REGION, node: process.version, pool: process.env.DB_POOL_MAX, steps });
}
