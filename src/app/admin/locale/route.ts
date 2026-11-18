import { NextResponse, type NextRequest } from "next/server";
import { isLocale } from "@/i18n/config";

export function GET(req: NextRequest) {
  const l = req.nextUrl.searchParams.get("l");
  const back = req.nextUrl.searchParams.get("back") ?? "/admin";
  const url = new URL(back.startsWith("/admin") ? back : "/admin", req.url);
  const res = NextResponse.redirect(url);
  if (isLocale(l)) res.cookies.set("NEXT_LOCALE", l, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
