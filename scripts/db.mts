/**
 *   npm run db:migrate   — apply supabase/migrations/*.sql in order (idempotent)
 *   npm run db:seed      — load the demo salon (supabase/seed.sql)
 * Uses DATABASE_URL (.env.local is loaded automatically).
 * On Supabase you can alternatively paste these files into the SQL editor.
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import postgres from "postgres";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");
const sql = postgres(url, { prepare: false, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require", onnotice: () => {} });
const cmd = process.argv[2];

if (cmd === "migrate") {
  await sql`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`;
  const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const [done] = await sql`select 1 from _migrations where name = ${file}`;
    if (done) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(`supabase/migrations/${file}`, "utf8"));
      await tx`insert into _migrations (name) values (${file})`;
    });
    console.log(`✔ applied ${file}`);
  }
  console.log("Migrations up to date.");
} else if (cmd === "seed") {
  await sql.unsafe(readFileSync("supabase/seed.sql", "utf8"));
  console.log("✔ Demo salon seeded.");
} else {
  console.error("Usage: tsx scripts/db.mts migrate|seed");
  process.exitCode = 1;
}
await sql.end();
