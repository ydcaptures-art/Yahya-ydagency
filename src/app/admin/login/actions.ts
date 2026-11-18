"use server";
import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";
import { getSalon } from "@/lib/catalog";

export async function loginAction(_prev: { error?: string } | undefined, fd: FormData) {
  const email = String(fd.get("email") ?? "").slice(0, 200);
  const password = String(fd.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "invalid" };
  const salon = await getSalon();
  const result = await login(email, password, salon.id);
  if (result !== "ok") return { error: result };
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}
