export const locales = ["tr", "en", "de"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "tr";

export const localeNames: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
  de: "Deutsch",
};

/** BCP-47 tags used for Intl formatting */
export const localeTags: Record<Locale, string> = {
  tr: "tr-TR",
  en: "en-GB",
  de: "de-DE",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Translatable DB value: {"en": "...", "tr": "...", "de": "..."} */
export type Localized = Partial<Record<Locale, string>>;

export function pick(value: Localized | null | undefined, locale: Locale, fallback: Locale = "en"): string {
  if (!value) return "";
  return value[locale] || value[fallback] || value.tr || value.en || value.de || "";
}
