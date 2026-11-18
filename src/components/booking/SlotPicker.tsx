"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { localeTags, type Locale } from "@/i18n/config";
import { fmt, type Dictionary } from "@/i18n/dictionaries";
import type { DaySlots } from "./types";

type Props = {
  locale: Locale;
  t: Pick<Dictionary["booking"], "morning" | "afternoon" | "evening" | "noSlots" | "nextAvailable" | "closedDay" | "loading" | "unavailable" | "genericError">;
  daysShort: string[];
  query: { branchId: string; serviceIds: string[]; employeeId: string | null; token?: string };
  today: string;
  maxAdvanceDays: number;
  selected: string | null; // startsAt ISO
  onSelect: (slot: { startsAt: string; time: string; date: string } | null) => void;
  refreshKey?: number;
};

const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const monthStart = (key: string) => key.slice(0, 7) + "-01";
const daysInMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const weekdayMon0 = (key: string) => (new Date(key + "T12:00:00Z").getUTCDay() + 6) % 7;

export function SlotPicker({ locale, t, daysShort, query, today, maxAdvanceDays, selected, onSelect, refreshKey = 0 }: Props) {
  const lastDay = addDays(today, maxAdvanceDays);
  const [month, setMonth] = useState(monthStart(today));
  const [days, setDays] = useState<Record<string, DaySlots>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeDate, setActiveDate] = useState<string | null>(selected ? null : null);

  const queryKey = JSON.stringify(query) + refreshKey;

  // Reset when the query (branch/services/professional) changes
  useEffect(() => {
    setDays({});
    setActiveDate(null);
  }, [queryKey]);

  useEffect(() => {
    const from = month < today ? today : month;
    const end = addDays(month, daysInMonth(month) - 1);
    const until = end > lastDay ? lastDay : end;
    if (from > until) return;
    const count = Math.round((Date.parse(until) - Date.parse(from)) / 86400000) + 1;
    const params = new URLSearchParams({ branchId: query.branchId, from, days: String(count) });
    query.serviceIds.forEach((s) => params.append("serviceId", s));
    if (query.employeeId) params.set("employeeId", query.employeeId);
    if (query.token) params.set("token", query.token);
    const ctrl = new AbortController();
    setLoading(true);
    setError(false);
    fetch(`/api/availability?${params}`, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((json: { days: DaySlots[] }) => {
        setDays((prev) => {
          const next = { ...prev };
          json.days.forEach((d) => (next[d.date] = d));
          return next;
        });
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setError(true);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, queryKey]);

  const hasSlots = (key: string) => !!days[key]?.slots.some((s) => s.available);

  // Auto-pick the first day with availability
  useEffect(() => {
    if (activeDate && days[activeDate]) return;
    const keys = Object.keys(days).sort();
    const first = keys.find((k) => hasSlots(k));
    if (first) setActiveDate(first);
    else if (!loading && keys.length && month < monthStart(lastDay) && !activeDate) {
      // Nothing this month — look at the next one
      setMonth(monthStart(addDays(addDays(month, daysInMonth(month) - 1), 1)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, loading]);

  const cells = useMemo(() => {
    const lead = weekdayMon0(month);
    const n = daysInMonth(month);
    return [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => addDays(month, i))] as (string | null)[];
  }, [month]);

  const monthLabel = new Intl.DateTimeFormat(localeTags[locale], { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(month + "T12:00:00Z"),
  );
  const canPrev = month > monthStart(today);
  const canNext = monthStart(addDays(month, daysInMonth(month))) <= monthStart(lastDay);
  const weekHeaders = [1, 2, 3, 4, 5, 6, 0].map((d) => daysShort[d]);

  const day = activeDate ? days[activeDate] : null;
  const groups = useMemo(() => {
    const slots = day?.slots ?? [];
    const h = (s: { time: string }) => Number(s.time.slice(0, 2));
    return [
      { label: t.morning, slots: slots.filter((s) => h(s) < 12) },
      { label: t.afternoon, slots: slots.filter((s) => h(s) >= 12 && h(s) < 17) },
      { label: t.evening, slots: slots.filter((s) => h(s) >= 17) },
    ].filter((g) => g.slots.length);
  }, [day, t]);
  const nextAvailable = activeDate ? Object.keys(days).sort().find((k) => k > activeDate && hasSlots(k)) : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-10">
      {/* Calendar */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => canPrev && setMonth(monthStart(addDays(month, -1)))} disabled={!canPrev}
            className="flex size-9 items-center justify-center rounded-full hover:bg-cream disabled:opacity-30" aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </button>
          <p className="font-display text-xl capitalize">{monthLabel}</p>
          <button type="button" onClick={() => canNext && setMonth(monthStart(addDays(month, daysInMonth(month))))} disabled={!canNext}
            className="flex size-9 items-center justify-center rounded-full hover:bg-cream disabled:opacity-30" aria-label="Next month">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-taupe">
          {weekHeaders.map((d) => <span key={d} className="py-1">{d}</span>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((key, i) => {
            if (!key) return <span key={`e${i}`} />;
            const inRange = key >= today && key <= lastDay;
            const info = days[key];
            const available = inRange && hasSlots(key);
            const isActive = key === activeDate;
            return (
              <button
                key={key}
                type="button"
                disabled={!available}
                onClick={() => {
                  setActiveDate(key);
                  onSelect(null);
                }}
                aria-pressed={isActive}
                aria-label={key}
                className={clsx(
                  "relative flex aspect-square items-center justify-center rounded-full text-sm tabular-nums transition",
                  isActive && "bg-espresso font-semibold text-porcelain",
                  !isActive && available && "font-medium text-espresso hover:bg-cream",
                  !available && "cursor-default text-taupe/40",
                  !available && info && !info.open && inRange && "line-through decoration-taupe/30",
                )}
              >
                {Number(key.slice(8))}
                {available && !isActive && <span className="absolute bottom-1 size-1 rounded-full bg-gold" />}
                {key === today && !isActive && <span className="absolute inset-0 rounded-full ring-1 ring-champagne" />}
              </button>
            );
          })}
        </div>
        {loading && (
          <p className="mt-3 flex items-center gap-2 text-xs text-taupe">
            <Loader2 className="size-3.5 animate-spin" /> {t.loading}
          </p>
        )}
      </div>

      {/* Slots */}
      <div aria-live="polite">
        {error ? (
          <p className="rounded-2xl bg-danger/10 p-4 text-sm text-danger">{t.genericError}</p>
        ) : !day ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-cream" />
            ))}
          </div>
        ) : (
          <>
            <p className="font-display text-2xl capitalize">
              {new Intl.DateTimeFormat(localeTags[locale], { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(day.date + "T12:00:00Z"))}
            </p>
            {!day.slots.some((s) => s.available) ? (
              <div className="mt-4 rounded-2xl border border-dashed border-line p-6 text-sm text-mocha">
                {day.open ? t.noSlots : t.closedDay}
                {nextAvailable && (
                  <button type="button" onClick={() => setActiveDate(nextAvailable)} className="mt-3 block font-semibold text-gold-dark underline-offset-4 hover:underline">
                    {fmt(t.nextAvailable, {
                      date: new Intl.DateTimeFormat(localeTags[locale], { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(nextAvailable + "T12:00:00Z")),
                    })}
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-5 space-y-6">
                {groups.map((g) => (
                  <div key={g.label}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-taupe">{g.label}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
                      {g.slots.map((s) => {
                        const isSel = selected === s.startsAt;
                        return (
                          <button
                            key={s.startsAt}
                            type="button"
                            disabled={!s.available}
                            onClick={() => onSelect({ startsAt: s.startsAt, time: s.time, date: day.date })}
                            aria-pressed={isSel}
                            title={s.available ? undefined : t.unavailable}
                            className={clsx(
                              "rounded-xl border py-3 text-sm font-medium tabular-nums transition",
                              isSel && "border-espresso bg-espresso text-porcelain shadow-soft",
                              !isSel && s.available && "border-line bg-porcelain hover:border-gold hover:bg-cream",
                              !s.available && "cursor-not-allowed border-transparent bg-cream/50 text-taupe/50 line-through",
                            )}
                          >
                            {s.time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
