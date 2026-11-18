"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { adminContext, f } from "@/lib/admin";
import { hashPassword } from "@/lib/auth";
import { sql, isUniqueViolation } from "@/lib/db";

export async function saveSettingsAction(fd: FormData) {
  const { salon } = await adminContext(["owner"]);
  const section = f.str(fd, "section");
  if (section === "salon") {
    const rating = Number.parseFloat(f.str(fd, "stat_rating").replace(",", "."));
    const stats = {
      ...(Number.isFinite(rating) && rating > 0 && rating <= 5 ? { rating } : {}),
      ...(f.int(fd, "stat_reviews", 0, 1e7, 0) ? { reviews: f.int(fd, "stat_reviews", 0, 1e7, 0) } : {}),
      ...(f.int(fd, "stat_clients", 0, 1e8, 0) ? { clients: f.int(fd, "stat_clients", 0, 1e8, 0) } : {}),
      ...(f.int(fd, "stat_years", 0, 200, 0) ? { years: f.int(fd, "stat_years", 0, 200, 0) } : {}),
    };
    await sql`update salons set ${sql({
      name: f.str(fd, "name", 80) || salon.name,
      tagline: f.localized(fd, "tagline", 80),
      about: f.localized(fd, "about", 1200),
      email: f.opt(fd, "email", 200),
      phone: f.opt(fd, "phone", 40),
      whatsapp: f.opt(fd, "whatsapp", 20)?.replace(/\D/g, "") || null,
      hero_image_url: f.url(fd, "hero_image_url"),
      logo_url: f.url(fd, "logo_url"),
      trust_stats: stats,
      phone_country_code: f.str(fd, "phone_country_code").replace(/\D/g, "").slice(0, 4) || salon.phone_country_code,
    })} where id = ${salon.id}`;
  } else if (section === "booking") {
    await sql`update salons set ${sql({
      slot_interval_minutes: f.int(fd, "slot_interval_minutes", 5, 120, 15),
      min_lead_minutes: f.int(fd, "min_lead_minutes", 0, 10080, 120),
      max_advance_days: f.int(fd, "max_advance_days", 1, 365, 60),
      auto_confirm: f.bool(fd, "auto_confirm"),
      booking_policy: f.localized(fd, "booking_policy", 1500),
      cancellation_window_hours: f.int(fd, "cancellation_window_hours", 0, 720, 24),
      reschedule_window_hours: f.int(fd, "reschedule_window_hours", 0, 720, 24),
      cancellation_policy: f.localized(fd, "cancellation_policy", 1500),
    })} where id = ${salon.id}`;
  } else if (section === "notifications") {
    await sql`update salons set ${sql({
      notify_email: f.bool(fd, "notify_email"),
      notify_whatsapp: f.bool(fd, "notify_whatsapp"),
      reminder_hours_before: f.int(fd, "reminder_hours_before", 1, 168, 24),
      staff_notification_email: f.opt(fd, "staff_notification_email", 200),
    })} where id = ${salon.id}`;
  } else if (section === "social") {
    await sql`update salons set ${sql({
      instagram_url: f.url(fd, "instagram_url"),
      instagram_handle: f.opt(fd, "instagram_handle", 60)?.replace(/^@/, "") ?? null,
      facebook_url: f.url(fd, "facebook_url"),
      tiktok_url: f.url(fd, "tiktok_url"),
    })} where id = ${salon.id}`;
  }
  revalidatePath("/", "layout");
  redirect(`/admin/settings?saved=1#${section}`);
}

export async function createUserAction(fd: FormData) {
  const { salon } = await adminContext(["owner"]);
  const role = f.str(fd, "role");
  const email = f.str(fd, "email", 200).toLowerCase();
  const employeeId = f.opt(fd, "employee_id");
  if (!["owner", "manager", "staff"].includes(role) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/admin/settings?error=invalid#team");
  if (role === "staff" && !employeeId) redirect("/admin/settings?error=employee#team");
  if (employeeId) {
    const [e] = await sql`select id from employees where id = ${employeeId} and salon_id = ${salon.id}`;
    if (!e) redirect("/admin/settings?error=invalid#team");
  }
  const temp = randomBytes(9).toString("base64url");
  try {
    await sql`insert into users (salon_id, email, password_hash, full_name, role, employee_id)
      values (${salon.id}, ${email}, ${await hashPassword(temp)}, ${f.str(fd, "full_name", 100) || email}, ${role}, ${employeeId})`;
  } catch (e) {
    if (isUniqueViolation(e)) redirect("/admin/settings?error=exists#team");
    throw e;
  }
  await flashTemp(email, temp);
  redirect("/admin/settings?created=1#team");
}

export async function toggleUserAction(fd: FormData) {
  const { salon, user } = await adminContext(["owner"]);
  const id = f.str(fd, "id");
  if (id === user.id) redirect("/admin/settings?error=self#team");
  await sql`update users set is_active = not is_active where id = ${id} and salon_id = ${salon.id}`;
  await sql`delete from sessions where user_id = ${id}`;
  redirect("/admin/settings?saved=1#team");
}

export async function resetUserPasswordAction(fd: FormData) {
  const { salon } = await adminContext(["owner"]);
  const id = f.str(fd, "id");
  const temp = randomBytes(9).toString("base64url");
  const [u] = await sql<{ email: string }[]>`update users set password_hash = ${await hashPassword(temp)} where id = ${id} and salon_id = ${salon.id} returning email`;
  if (!u) redirect("/admin/settings#team");
  await sql`delete from sessions where user_id = ${id}`;
  await flashTemp(u.email, temp);
  redirect("/admin/settings?created=1#team");
}

export async function changePasswordAction(fd: FormData) {
  const { user } = await adminContext();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next.length < 10) redirect("/admin/account?error=short");
  const [row] = await sql<{ password_hash: string }[]>`select password_hash from users where id = ${user.id}`;
  if (!(await bcrypt.compare(current, row.password_hash))) redirect("/admin/account?error=wrong");
  await sql`update users set password_hash = ${await hashPassword(next)} where id = ${user.id}`;
  redirect("/admin/account?saved=1");
}

/** Show a temporary password once via a 2-minute httpOnly cookie (never in URLs or the database) */
async function flashTemp(email: string, temp: string) {
  (await cookies()).set("yd_temp_pw", JSON.stringify({ email, temp }), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/admin/settings", maxAge: 120,
  });
}
