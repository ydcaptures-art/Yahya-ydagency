import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isLocale, type Locale, type Localized, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUser, type Role } from "./auth";
import { getSalon } from "./catalog";

export async function adminLocale(): Promise<Locale> {
  const c = (await cookies()).get("NEXT_LOCALE")?.value;
  return isLocale(c) ? c : "tr";
}

/** Auth + tenant + translations for every dashboard page */
export async function adminContext(roles?: Role[]) {
  const user = await requireUser(roles);
  const salon = await getSalon();
  const locale = await adminLocale();
  const dict = getDictionary(locale);
  return { user, salon, locale, t: dict.admin, dict };
}

/** Like adminContext but for pages: sends unauthorised roles back to the overview */
export async function adminPage(roles: Role[]) {
  try {
    return await adminContext(roles);
  } catch (e) {
    if ((e as Error).message === "forbidden") redirect("/admin?error=forbidden");
    throw e;
  }
}

// ---------------------------------------------------------------- FormData
export const f = {
  str(fd: FormData, key: string, max = 2000): string {
    return String(fd.get(key) ?? "").trim().slice(0, max);
  },
  opt(fd: FormData, key: string, max = 2000): string | null {
    const v = f.str(fd, key, max);
    return v === "" ? null : v;
  },
  int(fd: FormData, key: string, min: number, max: number, fallback = min): number {
    const n = Number.parseInt(String(fd.get(key) ?? ""), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  },
  bool(fd: FormData, key: string): boolean {
    const v = fd.get(key);
    return v === "on" || v === "true" || v === "1";
  },
  /** Price typed as "1.800,50" or "1800.50" → minor units */
  money(fd: FormData, key: string): number {
    let raw = f.str(fd, key).replace(/[^\d.,]/g, "");
    if (raw.includes(",") && raw.lastIndexOf(",") > raw.lastIndexOf(".")) raw = raw.replace(/\./g, "").replace(",", ".");
    else raw = raw.replace(/,/g, "");
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
  },
  localized(fd: FormData, key: string, max = 2000): Localized {
    const out: Localized = {};
    for (const l of locales) {
      const v = f.str(fd, `${key}.${l}`, max);
      if (v) out[l] = v;
    }
    return out;
  },
  ids(fd: FormData, key: string): string[] {
    const uuid = /^[0-9a-f-]{36}$/i;
    return fd.getAll(key).map(String).filter((v) => uuid.test(v));
  },
  url(fd: FormData, key: string): string | null {
    const v = f.opt(fd, key, 1000);
    if (!v) return null;
    return /^https:\/\//i.test(v) || v.startsWith("/") ? v : null;
  },
  time(fd: FormData, key: string): string | null {
    const v = f.str(fd, key);
    return /^\d{2}:\d{2}$/.test(v) ? v : null;
  },
};
