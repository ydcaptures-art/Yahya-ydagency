import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { sql } from "./db";

export const SESSION_COOKIE = "yd_session";
const SESSION_DAYS = 14;

export type Role = "owner" | "manager" | "staff";
export type SessionUser = {
  id: string;
  salon_id: string;
  email: string;
  full_name: string;
  role: Role;
  employee_id: string | null;
};

let dummyHash: string | undefined;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

/** Returns "ok" | "invalid" | "locked" */
export async function login(email: string, password: string, salonId: string): Promise<"ok" | "invalid" | "locked"> {
  const normalized = email.trim().toLowerCase();
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;

  const [{ failures }] = await sql<{ failures: number }[]>`
    select count(*)::int as failures from login_attempts
    where email = ${normalized} and not success and created_at > now() - interval '15 minutes'`;
  if (failures >= 5) return "locked";

  const [user] = await sql<{ id: string; password_hash: string; is_active: boolean }[]>`
    select id, password_hash, is_active from users where email = ${normalized} and salon_id = ${salonId}`;
  // Always run bcrypt to keep timing similar for unknown users
  dummyHash ??= await bcrypt.hash("timing-equaliser", 12);
  const ok = await bcrypt.compare(password, user?.password_hash ?? dummyHash);
  await sql`insert into login_attempts (email, ip, success) values (${normalized}, ${ip}, ${!!(ok && user?.is_active)})`;
  if (!ok || !user || !user.is_active) return "invalid";

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await sql`insert into sessions (user_id, token_hash, expires_at, user_agent)
    values (${user.id}, ${hashToken(token)}, ${expires}, ${h.get("user-agent")?.slice(0, 300) ?? null})`;
  await sql`update users set last_login_at = now() where id = ${user.id}`;
  await sql`delete from sessions where expires_at < now()`;

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  return "ok";
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql`delete from sessions where token_hash = ${hashToken(token)}`;
  jar.delete(SESSION_COOKIE);
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [user] = await sql<SessionUser[]>`
    select u.id, u.salon_id, u.email, u.full_name, u.role, u.employee_id
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${hashToken(token)} and s.expires_at > now() and u.is_active`;
  return user ?? null;
});

/**
 * Use in every admin page and server action. Redirects to login when signed
 * out; throws when the role is not allowed (never trust hidden buttons).
 */
export async function requireUser(roles: Role[] = ["owner", "manager", "staff"]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  const expectedSalon = process.env.SALON_SLUG || "maison-aurelle";
  const [salon] = await sql<{ slug: string }[]>`select slug from salons where id = ${user.salon_id}`;
  if (salon?.slug !== expectedSalon) redirect("/admin/login");
  if (!roles.includes(user.role)) throw new ForbiddenError();
  return user;
}

export class ForbiddenError extends Error {
  constructor() {
    super("forbidden");
  }
}

export const can = {
  manageSettings: (u: SessionUser) => u.role === "owner",
  manageUsers: (u: SessionUser) => u.role === "owner",
  manageCatalog: (u: SessionUser) => u.role === "owner" || u.role === "manager",
  viewRevenue: (u: SessionUser) => u.role === "owner" || u.role === "manager",
  manageAllAppointments: (u: SessionUser) => u.role === "owner" || u.role === "manager",
};
