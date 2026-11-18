/**
 * Create or update a dashboard user.
 *
 *   npm run user:create -- --email owner@salon.com --name "Salon Owner" --role owner [--password "..."] [--employee <employee-uuid>]
 *
 * If --password is omitted, a strong random password is generated and printed once.
 * Reads DATABASE_URL and SALON_SLUG from the environment (.env.local is loaded automatically).
 */
import { randomBytes } from "crypto";
import { readFileSync, existsSync } from "fs";
import bcrypt from "bcryptjs";
import postgres from "postgres";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce<string[][]>((acc, cur, i, arr) => (cur.startsWith("--") ? [...acc, [cur.slice(2), arr[i + 1]]] : acc), []),
);
const email = String(args.email ?? "").toLowerCase();
const role = args.role ?? "owner";
const name = args.name ?? email.split("@")[0];
if (!email || !["owner", "manager", "staff"].includes(role)) {
  console.error('Usage: npm run user:create -- --email you@salon.com --name "Name" --role owner|manager|staff [--password ...] [--employee <id>]');
  process.exit(1);
}
const password = args.password ?? randomBytes(12).toString("base64url");
if (password.length < 10) {
  console.error("Password must be at least 10 characters.");
  process.exit(1);
}

const url = process.env.DATABASE_URL!;
const sql = postgres(url, { prepare: false, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require" });
const slug = process.env.SALON_SLUG || "maison-aurelle";

const [salon] = await sql`select id from salons where slug = ${slug}`;
if (!salon) {
  console.error(`Salon "${slug}" not found`);
  process.exit(1);
}
const hash = await bcrypt.hash(password, 12);
await sql`
  insert into users (salon_id, email, password_hash, full_name, role, employee_id)
  values (${salon.id}, ${email}, ${hash}, ${name}, ${role}, ${args.employee ?? null})
  on conflict (email) do update set password_hash = excluded.password_hash, full_name = excluded.full_name,
    role = excluded.role, employee_id = excluded.employee_id, is_active = true`;
console.log(`✔ ${role} ${email} ready.${args.password ? "" : `\n  Temporary password: ${password}`}`);
await sql.end();
