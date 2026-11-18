import "server-only";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSalon } from "./catalog";

/** Resolve locale param + dictionary + tenant for a public page */
export async function pageContext(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [salon] = await Promise.all([getSalon()]);
  return { locale: locale as Locale, t: getDictionary(locale), salon };
}

export function whatsappLink(number: string | null, text: string) {
  if (!number) return null;
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
