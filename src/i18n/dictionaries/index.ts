import type { Locale } from "../config";
import en, { type Dictionary } from "./en";
import tr from "./tr";
import de from "./de";

const dictionaries: Record<Locale, Dictionary> = { en, tr, de };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.tr;
}

/** Replace {placeholders} in a translated string */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in values ? String(values[k]) : `{${k}}`));
}

export type { Dictionary };
