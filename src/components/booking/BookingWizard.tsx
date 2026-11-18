"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowLeft, ArrowRight, Check, Clock, MapPin, Plus, User, Users, CalendarPlus, Loader2, Sparkles, Phone,
} from "lucide-react";
import { localeTags, type Locale } from "@/i18n/config";
import { fmt, type Dictionary } from "@/i18n/dictionaries";
import { SmartImage } from "@/components/ui/SmartImage";
import { SlotPicker } from "./SlotPicker";
import type { WizardBranch, WizardCategory, WizardEmployee, WizardSalon, WizardService } from "./types";

type T = { booking: Dictionary["booking"]; hours: Dictionary["hours"]; services: Dictionary["services"]; nav: Dictionary["nav"] };

type Props = {
  locale: Locale;
  t: T;
  salon: WizardSalon;
  branches: WizardBranch[];
  categories: WizardCategory[];
  services: WizardService[];
  employees: WizardEmployee[];
  initialBranchId: string | null;
  initialServiceId: string | null;
};

type Confirmation = {
  reference: string;
  status: string;
  managePath: string;
  manageUrl: string;
  startsAt: string;
  endsAt: string;
  employee: { firstName: string; lastName: string } | null;
  delivered: string[];
};

const ANY = "any";

export function BookingWizard(props: Props) {
  const { locale, t, salon, branches, categories, services, employees } = props;
  const tb = t.booking;
  const money = (c: number) =>
    new Intl.NumberFormat(localeTags[locale], { style: "currency", currency: salon.currency, minimumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);

  // ------------------------------------------------------------------ state
  const singleBranch = branches.length === 1 ? branches[0].id : null;
  const initialBranch =
    singleBranch ??
    (props.initialBranchId && branches.some((b) => b.id === props.initialBranchId) ? props.initialBranchId : null);
  const [branchId, setBranchId] = useState<string | null>(initialBranch);
  const [serviceIds, setServiceIds] = useState<string[]>(() => {
    const s = services.find((x) => x.id === props.initialServiceId);
    return s && (!initialBranch || s.branch_ids.includes(initialBranch)) ? [s.id] : [];
  });
  const [employeeId, setEmployeeId] = useState<string | null>(null); // null = not chosen yet, "any" = any
  const [slot, setSlot] = useState<{ startsAt: string; time: string; date: string } | null>(null);
  const [step, setStep] = useState(initialBranch ? 1 : 0);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", notes: "", accept: false, website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  const branch = branches.find((b) => b.id === branchId) ?? null;
  const branchServices = useMemo(() => services.filter((s) => branchId && s.branch_ids.includes(branchId)), [services, branchId]);
  const selectedServices = serviceIds.map((id) => services.find((s) => s.id === id)!).filter(Boolean);
  const totalPrice = selectedServices.reduce((s, x) => s + x.price_cents, 0);
  const totalMinutes = selectedServices.reduce((s, x) => s + x.duration_minutes, 0);
  const anyFrom = selectedServices.some((s) => s.price_is_from);
  const eligibleEmployees = useMemo(
    () => employees.filter((e) => e.branch_id === branchId && serviceIds.every((id) => e.service_ids.includes(id))),
    [employees, branchId, serviceIds],
  );
  const employee = employees.find((e) => e.id === employeeId) ?? null;

  // Keep selections consistent when upstream choices change
  useEffect(() => {
    if (employeeId && employeeId !== ANY && !eligibleEmployees.some((e) => e.id === employeeId)) setEmployeeId(null);
  }, [eligibleEmployees, employeeId]);
  useEffect(() => setSlot(null), [branchId, serviceIds, employeeId]);

  const go = (n: number) => {
    setStep(n);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const canContinue = [!!branchId, serviceIds.length > 0, !!employeeId, !!slot, true, false][step];

  // ---------------------------------------------------------------- submit
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = tb.fieldRequired;
    if (!form.lastName.trim()) e.lastName = tb.fieldRequired;
    if (!/^[+\d][\d\s().-]{6,}$/.test(form.phone.trim())) e.phone = tb.invalidPhone;
    if (!form.email.trim()) e.email = tb.fieldRequired;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = tb.invalidEmail;
    if (!form.accept) e.accept = tb.fieldRequired;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate() || !branchId || !slot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          serviceIds,
          employeeId: employeeId === ANY ? null : employeeId,
          startsAt: slot.startsAt,
          locale,
          acceptPolicy: form.accept,
          website: form.website,
          customer: {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            notes: form.notes.trim() || undefined,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setConfirmation(json);
        go(5);
      } else if (res.status === 409) {
        setSubmitError(tb.slotTaken);
        setSlot(null);
        setRefreshKey((k) => k + 1);
        go(3);
      } else if (json?.fields?.phone) {
        setErrors((e) => ({ ...e, phone: tb.invalidPhone }));
      } else if (json?.fields?.customer) {
        setSubmitError(tb.genericError);
      } else {
        setSubmitError(tb.genericError);
      }
    } catch {
      setSubmitError(tb.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDateTime = (iso: string) =>
    new Intl.DateTimeFormat(localeTags[locale], { timeZone: salon.timezone, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso)) +
    " · " +
    new Intl.DateTimeFormat(localeTags[locale], { timeZone: salon.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

  const icsHref = useMemo(() => {
    if (!confirmation || !branch) return "#";
    const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//YD Agency//Salon Booking//EN", "BEGIN:VEVENT",
      `UID:${confirmation.reference}@salon`, `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(confirmation.startsAt)}`, `DTEND:${stamp(new Date(new Date(confirmation.startsAt).getTime() + totalMinutes * 60000).toISOString())}`,
      `SUMMARY:${salon.name} — ${selectedServices.map((s) => s.name).join(", ")}`,
      `LOCATION:${branch.address}\\, ${branch.city}`,
      `DESCRIPTION:${tb.reference}: ${confirmation.reference}\\n${confirmation.manageUrl}`,
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }, [confirmation, branch, salon.name, selectedServices, totalMinutes, tb.reference]);

  // ------------------------------------------------------------------ views
  const steps = tb.steps;
  const field = (name: keyof typeof form, label: string, type = "text", extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`f-${name}`} className="field-label">{label}</label>
      <input
        id={`f-${name}`}
        type={type}
        value={form[name] as string}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `e-${name}` : undefined}
        className={clsx("input", errors[name] && "border-danger")}
        {...extra}
      />
      {errors[name] && <p id={`e-${name}`} className="mt-1.5 text-xs text-danger">{errors[name]}</p>}
    </div>
  );

  if (step === 5 && confirmation) {
    return (
      <div ref={topRef} className="container-lux max-w-2xl scroll-mt-28">
        <div className="card animate-fade-up overflow-hidden">
          <div className="bg-espresso px-8 py-10 text-center text-porcelain">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-gold">
              <Check className="size-7" strokeWidth={2} />
            </span>
            <h1 className="heading-md mt-5">{fmt(tb.confirmedTitle, { name: form.firstName.trim() })}</h1>
            <p className="mt-2 text-sm text-porcelain/70">{tb.confirmedText}</p>
            <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-champagne">{tb.reference}</p>
            <p className="mt-1 font-display text-4xl tracking-[0.08em]">{confirmation.reference}</p>
          </div>
          <dl className="divide-y divide-line px-8 py-2 text-sm">
            {[
              [tb.when, fmtDateTime(confirmation.startsAt)],
              [tb.where, `${salon.name} ${branch?.name} — ${branch?.address}, ${branch?.city}`],
              [tb.with, confirmation.employee ? `${confirmation.employee.firstName} ${confirmation.employee.lastName}` : "—"],
              [tb.services, selectedServices.map((s) => s.name).join(", ")],
              [tb.totalDuration, fmt(t.services.duration, { min: totalMinutes })],
              [tb.estimatedTotal, `${anyFrom ? t.services.from + " " : ""}${money(totalPrice)}`],
              [tb.yourDetails, `${form.firstName} ${form.lastName} · ${form.phone}`],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-4 py-4">
                <dt className="text-xs uppercase tracking-[0.12em] text-taupe">{k}</dt>
                <dd className="col-span-2 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-4 border-t border-line bg-cream/50 px-8 py-6">
            <p className="text-sm text-mocha">
              {confirmation.delivered.length
                ? fmt(tb.notificationsSent, { channels: confirmation.delivered.map((c) => (c === "email" ? "e-mail" : "WhatsApp")).join(" & ") })
                : tb.notificationsNone}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a href={icsHref} download={`${confirmation.reference}.ics`} className="btn-outline flex-1">
                <CalendarPlus className="size-4" /> {tb.addToCalendar}
              </a>
              <Link href={confirmation.managePath} className="btn-primary flex-1">{tb.manageBooking}</Link>
            </div>
            <p className="text-xs leading-relaxed text-taupe">{salon.cancellationPolicy}</p>
          </div>
        </div>
        <p className="mt-6 text-center">
          <Link href={`/${locale}`} className="link-underline text-sm text-mocha">{t.nav.home}</Link>
        </p>
      </div>
    );
  }

  return (
    <div ref={topRef} className="container-lux scroll-mt-28">
      {/* Header + progress */}
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="heading-lg">{tb.title}</h1>
        <p className="mt-3 text-sm text-mocha">{tb.subtitle}</p>
      </div>
      <ol className="no-scrollbar mx-auto mt-8 flex max-w-4xl items-center justify-between gap-2 overflow-x-auto" aria-label={fmt(tb.stepOf, { n: step + 1, total: 6 })}>
        {steps.slice(0, 5).map((label, i) => {
          const done = i < step;
          const reachable = i < step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && go(i)}
                aria-current={i === step ? "step" : undefined}
                className={clsx("flex items-center gap-2 whitespace-nowrap", !reachable && "cursor-default")}
              >
                <span
                  className={clsx(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition",
                    i === step && "bg-espresso text-porcelain",
                    done && "bg-gold text-porcelain",
                    i > step && "border border-line text-taupe",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={clsx("hidden text-xs font-medium md:inline", i === step ? "text-espresso" : "text-taupe")}>{label}</span>
              </button>
              {i < 4 && <span className={clsx("h-px flex-1", done ? "bg-gold" : "bg-line")} />}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-xs text-taupe md:hidden">
        {fmt(tb.stepOf, { n: step + 1, total: 5 })} · {steps[step]}
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <section className="min-w-0 animate-fade-in" key={step}>
          {submitError && step !== 4 && <p className="mb-6 rounded-2xl bg-danger/10 p-4 text-sm text-danger" role="alert">{submitError}</p>}

          {/* STEP 1 — branch */}
          {step === 0 && (
            <>
              <h2 className="heading-md">{tb.selectBranch}</h2>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {branches.map((b) => {
                  const count = services.filter((s) => s.branch_ids.includes(b.id)).length;
                  const active = b.id === branchId;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setBranchId(b.id);
                        setServiceIds((ids) => ids.filter((id) => services.find((s) => s.id === id)?.branch_ids.includes(b.id)));
                        go(1);
                      }}
                      className={clsx(
                        "card group overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-lift",
                        active && "ring-2 ring-gold",
                      )}
                    >
                      <SmartImage src={b.image_url ?? ""} alt={b.name} fill sizes="(min-width: 768px) 30vw, 100vw" wrapperClassName="aspect-[16/9]" className="transition duration-700 group-hover:scale-105" />
                      <div className="p-6">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-2xl">{b.name}</h3>
                          <span className="text-xs text-taupe">{fmt(tb.servicesAvailable, { count })}</span>
                        </div>
                        <p className="mt-2 flex items-start gap-2 text-sm text-mocha">
                          <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} /> {b.address}, {b.city}
                        </p>
                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-mocha">
                          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                            const h = b.hours.find((x) => x.weekday === d);
                            return (
                              <div key={d} className="flex justify-between gap-2">
                                <dt>{t.hours.daysShort[d]}</dt>
                                <dd className="tabular-nums">{!h || h.is_closed ? t.hours.closed : `${h.open_time}–${h.close_time}`}</dd>
                              </div>
                            );
                          })}
                        </dl>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* STEP 2 — services */}
          {step === 1 && (
            <>
              <h2 className="heading-md">{tb.selectServices}</h2>
              <p className="mt-2 text-sm text-mocha">{tb.selectServicesHint}</p>
              <div className="no-scrollbar sticky top-[72px] z-20 -mx-5 mt-6 flex gap-2 overflow-x-auto bg-ivory/95 px-5 py-3 backdrop-blur lg:top-20">
                {categories
                  .filter((c) => branchServices.some((s) => s.category_id === c.id))
                  .map((c) => (
                    <a key={c.id} href={`#cat-${c.id}`} className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-xs font-medium whitespace-nowrap hover:border-espresso">
                      {c.name}
                    </a>
                  ))}
              </div>
              <div className="mt-4 space-y-10">
                {categories.map((c) => {
                  const items = branchServices.filter((s) => s.category_id === c.id);
                  if (!items.length) return null;
                  return (
                    <div key={c.id} id={`cat-${c.id}`} className="scroll-mt-40">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-dark">{c.name}</h3>
                      <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-porcelain">
                        {items.map((s) => {
                          const on = serviceIds.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setServiceIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
                              aria-pressed={on}
                              className={clsx("flex w-full items-center gap-4 p-4 text-left transition sm:p-5", on ? "bg-cream" : "hover:bg-ivory")}
                            >
                              <SmartImage src={s.image_url ?? ""} alt="" fill sizes="64px" wrapperClassName="hidden size-16 shrink-0 rounded-xl sm:block" />
                              <span className="min-w-0 flex-1">
                                <span className="block font-medium">{s.name}</span>
                                <span className="mt-0.5 line-clamp-1 block text-xs text-mocha">{s.description}</span>
                                <span className="mt-1.5 flex items-center gap-3 text-xs text-taupe">
                                  <span className="flex items-center gap-1"><Clock className="size-3" /> {fmt(t.services.duration, { min: s.duration_minutes })}</span>
                                  <span className="font-semibold text-espresso">
                                    {s.price_is_from && <span className="font-normal text-taupe">{t.services.from} </span>}
                                    {money(s.price_cents)}
                                  </span>
                                </span>
                              </span>
                              <span
                                className={clsx(
                                  "flex size-9 shrink-0 items-center justify-center rounded-full border transition",
                                  on ? "border-espresso bg-espresso text-porcelain" : "border-line text-espresso",
                                )}
                                aria-hidden
                              >
                                {on ? <Check className="size-4" /> : <Plus className="size-4" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* STEP 3 — professional */}
          {step === 2 && (
            <>
              <h2 className="heading-md">{tb.selectProfessional}</h2>
              {eligibleEmployees.length === 0 ? (
                <p className="mt-6 rounded-2xl bg-warning/10 p-5 text-sm text-espresso">{tb.noProfessional}</p>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => { setEmployeeId(ANY); go(3); }}
                    className={clsx("card flex items-center gap-4 p-5 text-left transition hover:shadow-lift sm:col-span-2", employeeId === ANY && "ring-2 ring-gold")}
                  >
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-cream text-gold-dark">
                      <Users className="size-7" strokeWidth={1.25} />
                    </span>
                    <span>
                      <span className="flex items-center gap-2 font-display text-xl">
                        {tb.anyProfessional} <Sparkles className="size-4 text-gold" />
                      </span>
                      <span className="mt-1 block text-sm text-mocha">{tb.anyProfessionalHint}</span>
                    </span>
                  </button>
                  {eligibleEmployees.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => { setEmployeeId(e.id); go(3); }}
                      className={clsx("card flex items-center gap-4 p-5 text-left transition hover:shadow-lift", employeeId === e.id && "ring-2 ring-gold")}
                    >
                      <SmartImage src={e.photo_url ?? ""} alt={e.name} fill sizes="64px" wrapperClassName="size-16 shrink-0 rounded-full" />
                      <span className="min-w-0">
                        <span className="block font-display text-xl">{e.name}</span>
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-dark">{e.title}</span>
                        <span className="mt-1 line-clamp-2 block text-xs text-mocha">{e.bio}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* STEP 4 — date & time */}
          {step === 3 && branchId && (
            <>
              <h2 className="heading-md mb-6">{tb.selectDateTime}</h2>
              <SlotPicker
                locale={locale}
                t={tb}
                daysShort={t.hours.daysShort}
                query={{ branchId, serviceIds, employeeId: employeeId === ANY ? null : employeeId }}
                today={salon.today}
                maxAdvanceDays={salon.maxAdvanceDays}
                selected={slot?.startsAt ?? null}
                onSelect={(s) => { setSlot(s); if (s) setSubmitError(null); }}
                refreshKey={refreshKey}
              />
            </>
          )}

          {/* STEP 5 — details */}
          {step === 4 && (
            <form
              noValidate
              onSubmit={(e) => { e.preventDefault(); submit(); }}
              className="max-w-2xl"
            >
              <h2 className="heading-md">{tb.yourDetails}</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {field("firstName", tb.firstName, "text", { autoComplete: "given-name", required: true })}
                {field("lastName", tb.lastName, "text", { autoComplete: "family-name", required: true })}
                <div>
                  {field("phone", tb.phone, "tel", { autoComplete: "tel", inputMode: "tel", required: true, placeholder: "+90 5XX XXX XX XX" })}
                  {!errors.phone && <p className="mt-1.5 text-xs text-taupe">{tb.phoneHint}</p>}
                </div>
                {field("email", tb.email, "email", { autoComplete: "email", inputMode: "email", required: true })}
                <div className="sm:col-span-2">
                  <label htmlFor="f-notes" className="field-label">{tb.notes}</label>
                  <textarea
                    id="f-notes"
                    rows={3}
                    maxLength={1000}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder={tb.notesPlaceholder}
                    className="input resize-none"
                  />
                </div>
                {/* Honeypot (hidden from humans) */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} className="hidden" aria-hidden />
              </div>
              <div className="mt-6 rounded-2xl bg-cream/70 p-5 text-xs leading-relaxed text-mocha">
                <p className="font-semibold uppercase tracking-[0.14em] text-espresso">{tb.policyTitle}</p>
                <p className="mt-2">{salon.bookingPolicy}</p>
                <p className="mt-2">{salon.cancellationPolicy}</p>
              </div>
              <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={form.accept} onChange={(e) => setForm((f) => ({ ...f, accept: e.target.checked }))} className="checkbox mt-0.5" />
                <span>{tb.policyAgree}{errors.accept && <span className="ml-2 text-xs text-danger">{errors.accept}</span>}</span>
              </label>
              {submitError && <p className="mt-5 rounded-2xl bg-danger/10 p-4 text-sm text-danger" role="alert">{submitError}</p>}
              <button type="submit" disabled={submitting} className="btn-gold mt-8 hidden w-full py-4 text-[15px] lg:flex">
                {submitting ? <><Loader2 className="size-4 animate-spin" /> {tb.confirming}</> : <>{tb.confirmBooking} <Check className="size-4" /></>}
              </button>
            </form>
          )}

          {step > 0 && !(singleBranch && step === 1) && (
            <button type="button" onClick={() => go(step - 1)} className="mt-10 hidden items-center gap-2 text-sm text-mocha hover:text-espresso lg:inline-flex">
              <ArrowLeft className="size-4" /> {tb.back}
            </button>
          )}
        </section>

        {/* Summary — sidebar on desktop */}
        <aside className="hidden lg:block">
          <div className="card sticky top-28 p-6">
            <Summary />
            {step < 4 && (
              <button type="button" disabled={!canContinue} onClick={() => go(step + 1)} className="btn-primary mt-6 w-full py-3.5">
                {tb.continue} <ArrowRight className="size-4" />
              </button>
            )}
            {salon.phone && (
              <a href={`tel:${salon.phone.replace(/\s/g, "")}`} className="mt-4 flex items-center justify-center gap-2 text-xs text-taupe hover:text-espresso">
                <Phone className="size-3.5" /> {salon.phone}
              </a>
            )}
          </div>
        </aside>
      </div>

      {/* Bottom bar — mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-porcelain/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-3">
          {step > 0 && !(singleBranch && step === 1) && (
            <button type="button" onClick={() => go(step - 1)} className="flex size-12 shrink-0 items-center justify-center rounded-full border border-line" aria-label={tb.back}>
              <ArrowLeft className="size-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-taupe">
              {serviceIds.length ? `${serviceIds.length} · ${fmt(t.services.duration, { min: totalMinutes })}` : tb.noServices}
              {slot ? ` · ${slot.time}` : ""}
            </p>
            <p className="font-semibold">{serviceIds.length ? `${anyFrom ? t.services.from + " " : ""}${money(totalPrice)}` : "—"}</p>
          </div>
          {step < 4 ? (
            <button type="button" disabled={!canContinue} onClick={() => go(step + 1)} className="btn-primary px-6 py-3.5">
              {tb.continue} <ArrowRight className="size-4" />
            </button>
          ) : (
            <button type="button" disabled={submitting} onClick={submit} className="btn-gold px-6 py-3.5">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {tb.confirmBooking}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  function Summary() {
    return (
      <div>
        <p className="eyebrow">{tb.summary}</p>
        <div className="mt-5 space-y-4 text-sm">
          <SummaryRow icon={<MapPin className="size-4" />} label={tb.steps[0]} onEdit={!singleBranch && step > 0 ? () => go(0) : undefined} editLabel={tb.change}>
            {branch ? `${branch.name}` : "—"}
          </SummaryRow>
          <SummaryRow icon={<Sparkles className="size-4" />} label={tb.steps[1]} onEdit={step > 1 ? () => go(1) : undefined} editLabel={tb.change}>
            {selectedServices.length ? (
              <ul className="space-y-1.5">
                {selectedServices.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3">
                    <span>{s.name}</span>
                    <span className="shrink-0 tabular-nums text-mocha">{money(s.price_cents)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-taupe">{tb.noServices}</span>
            )}
          </SummaryRow>
          <SummaryRow icon={<User className="size-4" />} label={tb.steps[2]} onEdit={step > 2 ? () => go(2) : undefined} editLabel={tb.change}>
            {employeeId === ANY ? tb.anyProfessional : employee ? employee.name : "—"}
          </SummaryRow>
          <SummaryRow icon={<Clock className="size-4" />} label={tb.steps[3]} onEdit={step > 3 ? () => go(3) : undefined} editLabel={tb.change}>
            {slot ? fmtDateTime(slot.startsAt) : "—"}
          </SummaryRow>
        </div>
        <div className="mt-6 space-y-1.5 border-t border-line pt-5 text-sm">
          <div className="flex justify-between text-mocha">
            <span>{tb.totalDuration}</span>
            <span className="tabular-nums">{totalMinutes ? fmt(t.services.duration, { min: totalMinutes }) : "—"}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">{tb.total}</span>
            <span className="font-display text-2xl">
              {anyFrom && totalPrice > 0 && <span className="mr-1 font-sans text-xs text-taupe">{t.services.from}</span>}
              {money(totalPrice)}
            </span>
          </div>
        </div>
      </div>
    );
  }
}

function SummaryRow({ icon, label, children, onEdit, editLabel }: {
  icon: React.ReactNode; label: string; children: React.ReactNode; onEdit?: () => void; editLabel: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-gold-dark">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.14em] text-taupe">{label}</span>
          {onEdit && (
            <button type="button" onClick={onEdit} className="text-[11px] font-semibold text-gold-dark hover:underline">{editLabel}</button>
          )}
        </div>
        <div className="mt-0.5 font-medium">{children}</div>
      </div>
    </div>
  );
}
