import { localeTags, type Locale } from "@/i18n/config";

export function formatMoney(cents: number, currency: string, locale: Locale): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(localeTags[locale], {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
