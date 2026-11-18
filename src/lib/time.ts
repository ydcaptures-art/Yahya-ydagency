import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { localeTags, type Locale } from "@/i18n/config";

/** "YYYY-MM-DD" for a Date in the given time zone */
export function toDateKey(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "yyyy-MM-dd");
}

/** Local wall-clock date + "HH:mm" in a zone → absolute instant */
export function zonedToUtc(dateKey: string, time: string, tz: string): Date {
  return fromZonedTime(`${dateKey}T${time.length === 5 ? time + ":00" : time}`, tz);
}

/** 0 = Sunday … 6 = Saturday for a "YYYY-MM-DD" date key */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z"));
}

/** "09:30:00" | "09:30" → minutes since midnight */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDate(date: Date | string, locale: Locale, tz: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(localeTags[locale], {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function formatTime(date: Date | string, locale: Locale, tz: string): string {
  return new Intl.DateTimeFormat(localeTags[locale], {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function formatDateKey(dateKey: string, locale: Locale, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(localeTags[locale], {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    ...opts,
  }).format(new Date(dateKey + "T12:00:00Z"));
}
