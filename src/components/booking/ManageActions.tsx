"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Phone, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { SlotPicker } from "./SlotPicker";

type Props = {
  locale: Locale;
  token: string;
  t: { manage: Dictionary["manage"]; booking: Dictionary["booking"]; daysShort: string[] };
  canCancel: boolean;
  canReschedule: boolean;
  lockedText: string;
  salonPhone: string | null;
  query: { branchId: string; serviceIds: string[]; employeeId: string | null; token: string };
  today: string;
  maxAdvanceDays: number;
};

export function ManageActions(p: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "cancel" | "reschedule">("idle");
  const [slot, setSlot] = useState<{ startsAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const call = async (body: object, okText: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/manage/${p.token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ ok: true, text: okText });
        setMode("idle");
        router.refresh();
      } else if (res.status === 409) {
        setMessage({ ok: false, text: p.t.booking.slotTaken });
        setSlot(null);
        setRefreshKey((k) => k + 1);
      } else if (json.error === "window_passed") {
        setMessage({ ok: false, text: p.lockedText });
      } else {
        setMessage({ ok: false, text: p.t.booking.genericError });
      }
    } finally {
      setBusy(false);
    }
  };

  if (!p.canCancel && !p.canReschedule) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-mocha">{p.lockedText}</p>
        {p.salonPhone && (
          <a href={`tel:${p.salonPhone.replace(/\s/g, "")}`} className="btn-primary w-full"><Phone className="size-4" /> {p.t.manage.callSalon}</a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {message && (
        <p role="status" className={`rounded-xl p-4 text-sm ${message.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>{message.text}</p>
      )}
      {mode === "idle" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {p.canReschedule && (
            <button type="button" onClick={() => setMode("reschedule")} className="btn-primary flex-1"><CalendarClock className="size-4" /> {p.t.manage.reschedule}</button>
          )}
          {p.canCancel && (
            <button type="button" onClick={() => setMode("cancel")} className="btn-outline flex-1"><X className="size-4" /> {p.t.manage.cancel}</button>
          )}
        </div>
      )}
      {mode === "cancel" && (
        <div className="rounded-2xl border border-danger/30 bg-porcelain p-5">
          <p className="font-medium">{p.t.manage.cancelConfirm}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={busy} onClick={() => call({ action: "cancel" }, p.t.manage.cancelled)} className="btn flex-1 bg-danger text-porcelain hover:opacity-90">
              {busy && <Loader2 className="size-4 animate-spin" />} {p.t.manage.cancelYes}
            </button>
            <button type="button" onClick={() => setMode("idle")} className="btn-outline flex-1">{p.t.manage.keep}</button>
          </div>
        </div>
      )}
      {mode === "reschedule" && (
        <div>
          <p className="font-display text-xl">{p.t.manage.rescheduleTitle}</p>
          <div className="mt-4">
            <SlotPicker
              locale={p.locale}
              t={p.t.booking}
              daysShort={p.t.daysShort}
              query={p.query}
              today={p.today}
              maxAdvanceDays={p.maxAdvanceDays}
              selected={slot?.startsAt ?? null}
              onSelect={(s) => setSlot(s)}
              refreshKey={refreshKey}
            />
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={!slot || busy} onClick={() => slot && call({ action: "reschedule", startsAt: slot.startsAt }, p.t.manage.rescheduled)} className="btn-gold flex-1">
              {busy && <Loader2 className="size-4 animate-spin" />} {p.t.booking.continue}
            </button>
            <button type="button" onClick={() => setMode("idle")} className="btn-outline flex-1">{p.t.manage.keep}</button>
          </div>
        </div>
      )}
    </div>
  );
}
