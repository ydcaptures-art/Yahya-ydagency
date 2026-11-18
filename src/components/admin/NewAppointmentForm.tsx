"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { SubmitButton } from "./SubmitButton";

type Props = {
  action: (fd: FormData) => Promise<void>;
  branches: { id: string; name: string }[];
  services: { id: string; name: string; category: string; duration: number; price: string; branch_ids: string[] }[];
  employees: { id: string; name: string; branch_id: string; service_ids: string[] }[];
  today: string;
  lockEmployeeId: string | null;
  t: Record<string, string>;
};

export function NewAppointmentForm({ action, branches, services, employees, today, lockEmployeeId, t }: Props) {
  const lockedBranch = lockEmployeeId ? employees.find((e) => e.id === lockEmployeeId)?.branch_id : undefined;
  const [branchId, setBranchId] = useState(lockedBranch ?? branches[0]?.id ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState(lockEmployeeId ?? "any");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<{ time: string; available: boolean }[] | null>(null);

  const branchServices = services.filter((s) => s.branch_ids.includes(branchId));
  const eligible = useMemo(
    () => employees.filter((e) => e.branch_id === branchId && serviceIds.every((id) => e.service_ids.includes(id))),
    [employees, branchId, serviceIds],
  );
  useEffect(() => {
    if (employeeId !== "any" && !eligible.some((e) => e.id === employeeId) && !lockEmployeeId) setEmployeeId("any");
  }, [eligible, employeeId, lockEmployeeId]);

  useEffect(() => {
    setSlots(null);
    if (!branchId || !serviceIds.length || !date) return;
    const p = new URLSearchParams({ branchId, from: date, days: "1" });
    serviceIds.forEach((s) => p.append("serviceId", s));
    if (employeeId !== "any") p.set("employeeId", employeeId);
    const ctrl = new AbortController();
    fetch(`/api/availability?${p}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => setSlots(j.days?.[0]?.slots ?? []))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [branchId, serviceIds, employeeId, date]);

  const categories = Array.from(new Set(branchServices.map((s) => s.category)));

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="rounded-2xl border border-line bg-porcelain p-6 shadow-soft">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-mocha">{t.branch}</span>
              <select name="branchId" value={branchId} disabled={!!lockedBranch} onChange={(e) => { setBranchId(e.target.value); setServiceIds([]); }} className="input-sm">
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {lockedBranch && <input type="hidden" name="branchId" value={branchId} />}
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-mocha">{t.employee}</span>
              <select name="employeeId" value={employeeId} disabled={!!lockEmployeeId} onChange={(e) => setEmployeeId(e.target.value)} className="input-sm">
                <option value="any">{t.any}</option>
                {eligible.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-6 mb-2 text-xs font-semibold text-mocha">{t.services}</p>
          <div className="max-h-80 space-y-4 overflow-y-auto rounded-xl border border-line p-3">
            {categories.map((c) => (
              <div key={c}>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-dark">{c}</p>
                <div className="mt-1 grid gap-1 sm:grid-cols-2">
                  {branchServices.filter((s) => s.category === c).map((s) => (
                    <label key={s.id} className={clsx("flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm", serviceIds.includes(s.id) && "bg-cream")}>
                      <input
                        type="checkbox"
                        name="serviceIds"
                        value={s.id}
                        checked={serviceIds.includes(s.id)}
                        onChange={(e) => setServiceIds((ids) => (e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id)))}
                        className="checkbox"
                      />
                      <span className="flex-1">{s.name}</span>
                      <span className="text-xs text-taupe">{s.duration}′ · {s.price}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-porcelain p-6 shadow-soft">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-mocha">{t.date}</span>
              <input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} required className="input-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-mocha">{t.time}</span>
              <input type="time" name="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} required className="input-sm" />
            </label>
          </div>
          {slots && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-mocha">{t.pickSlot}</p>
              <div className="flex flex-wrap gap-1.5">
                {slots.filter((s) => s.available).map((s) => (
                  <button type="button" key={s.time} onClick={() => setTime(s.time)}
                    className={clsx("rounded-lg border px-2.5 py-1 text-xs tabular-nums", time === s.time ? "border-espresso bg-espresso text-porcelain" : "border-line hover:border-gold")}>
                    {s.time}
                  </button>
                ))}
                {slots.every((s) => !s.available) && <span className="text-xs text-taupe">{t.noSlots}</span>}
              </div>
            </div>
          )}
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" name="override" className="checkbox" /> {t.override}</label>
        </section>
      </div>

      <section className="h-fit space-y-4 rounded-2xl border border-line bg-porcelain p-6 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mocha">{t.customer}</p>
        <input name="phone" type="tel" required placeholder={t.phone} className="input-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input name="firstName" required placeholder={t.firstName} className="input-sm" />
          <input name="lastName" required placeholder={t.lastName} className="input-sm" />
        </div>
        <input name="email" type="email" placeholder={t.email} className="input-sm" />
        <div className="grid grid-cols-2 gap-2">
          <select name="locale" defaultValue="tr" className="input-sm" aria-label="Language">
            <option value="tr">Türkçe</option><option value="en">English</option><option value="de">Deutsch</option>
          </select>
          <select name="source" defaultValue="phone" className="input-sm" aria-label={t.source}>
            <option value="phone">Phone</option><option value="walk_in">Walk-in</option><option value="admin">Admin</option>
          </select>
        </div>
        <textarea name="internal_notes" rows={3} placeholder={t.notes} className="input-sm" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked className="checkbox" /> {t.notify}</label>
        <SubmitButton className="btn-primary w-full py-3">{t.create}</SubmitButton>
      </section>
    </form>
  );
}
