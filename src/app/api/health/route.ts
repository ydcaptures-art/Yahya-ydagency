import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSalon, getBranches, getServices, getEmployees, getCategories, getPublicContent } from "@/lib/catalog";

export const dynamic = "force-dynamic";

/** Diagnostic: times each database step (each limited to 8s). */
export async function GET() {
  const steps: Record<string, string> = {};
  const run = async (name: string, fn: () => Promise<unknown>) => {
    const t0 = Date.now();
    try {
      const v = await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT 8s")), 8000))]);
      steps[name] = `ok ${Date.now() - t0}ms ${JSON.stringify(v)?.slice(0, 400)}`;
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
  if (salon) {
    await run("getCategories", async () => (await getCategories(salon.id)).length);
    await run("getServices", async () => (await getServices(salon.id)).length);
    await run("getEmployees", async () => (await getEmployees(salon.id)).length);
    await run("getPublicContent", async () => Object.keys(await getPublicContent(salon.id)).length);
  }
  await run("activity", async () =>
    sql`select pid, state, wait_event_type as wt, wait_event as we, extract(epoch from now()-query_start)::int as secs, left(query, 70) as q
        from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and state <> 'idle' limit 8`);
  await run("ungranted_locks", async () => (await sql`select count(*)::int as n from pg_locks where not granted`)[0]);
  await run("statement_timeout", async () => (await sql`show statement_timeout`)[0]);
  await run("parallel3", async () => Promise.all([sql`select 1`, sql`select 2`, sql`select 3`]).then((r) => r.length));
  return NextResponse.json({ region: process.env.VERCEL_REGION, node: process.version, pool: process.env.DB_POOL_MAX, steps });
}
