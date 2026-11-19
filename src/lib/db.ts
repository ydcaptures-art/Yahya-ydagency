import "server-only";
import postgres from "postgres";

declare global {
  var __sql: postgres.Sql | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, {
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idle_timeout: 10,
    connect_timeout: 10, // fail fast instead of hanging until the platform timeout
    max_lifetime: 60 * 5,
    // Supabase's transaction pooler (port 6543) does not support prepared statements
    prepare: false,
    ssl: isLocal ? false : "require",
    transform: { undefined: null },
  });
}

/** Server-only SQL client. Re-used across hot reloads in development. */
export const sql: postgres.Sql = globalThis.__sql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__sql = sql;

export function isExclusionViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23P01";
}
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}
