import type { Metadata } from "next";
import { display, sans } from "../fonts";
import "../globals.css";
import { adminLocale } from "@/lib/admin";


export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const locale = await adminLocale();
  return (
    <html lang={locale} className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh bg-[#f7f3ed]">{children}</body>
    </html>
  );
}
