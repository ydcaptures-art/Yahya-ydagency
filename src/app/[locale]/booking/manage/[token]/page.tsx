import type { Metadata } from "next";
import Link from "next/link";
import { pick } from "@/i18n/config";
import { fmt } from "@/i18n/dictionaries";
import { pageContext } from "@/lib/site";
import { getAppointmentByToken, canCustomerChange } from "@/lib/booking";
import { formatDate, formatTime, toDateKey } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { ManageActions } from "@/components/booking/ManageActions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ManagePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { token } = await params;
  const { locale, t, salon } = await pageContext(params);
  const appt = await getAppointmentByToken(salon.id, token);
  const tm = t.manage;

  if (!appt) {
    return (
      <div className="container-lux max-w-xl pt-36 pb-24 text-center">
        <h1 className="heading-md">{tm.notFound}</h1>
        <Link href={`/${locale}/booking`} className="btn-primary mt-8">{t.nav.bookAppointment}</Link>
      </div>
    );
  }

  const cancel = canCustomerChange(salon, appt, "cancel");
  const reschedule = canCustomerChange(salon, appt, "reschedule");
  const statusColor: Record<string, string> = {
    confirmed: "bg-success/10 text-success",
    pending: "bg-warning/10 text-warning",
    completed: "bg-cream text-mocha",
    cancelled: "bg-danger/10 text-danger",
    no_show: "bg-danger/10 text-danger",
  };
  const isPast = new Date(appt.starts_at).getTime() < Date.now();

  return (
    <div className="container-lux max-w-2xl pt-28 pb-32 lg:pt-36">
      <p className="eyebrow text-center">{salon.name}</p>
      <h1 className="heading-lg mt-3 text-center">{tm.title}</h1>
      <div className="card mt-10 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-5 sm:px-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-taupe">{t.booking.reference}</p>
            <p className="font-display text-2xl tracking-[0.06em]">{appt.reference}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[appt.status]}`}>{tm.statuses[appt.status]}</span>
        </div>
        <dl className="divide-y divide-line px-6 text-sm sm:px-8">
          {[
            [t.booking.when, `${formatDate(appt.starts_at, locale, salon.timezone)} · ${formatTime(appt.starts_at, locale, salon.timezone)}`],
            [t.booking.where, `${appt.branch.name} — ${appt.branch.address}, ${appt.branch.city}`],
            [t.booking.with, `${appt.employee.first_name} ${appt.employee.last_name}`],
            [t.booking.services, appt.services.map((s) => pick(s.name, locale)).join(", ")],
            [t.booking.estimatedTotal, formatMoney(appt.total_price_cents, salon.currency, locale)],
          ].map(([k, v]) => (
            <div key={k} className="grid grid-cols-3 gap-4 py-4">
              <dt className="text-xs uppercase tracking-[0.12em] text-taupe">{k}</dt>
              <dd className="col-span-2 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-line bg-cream/50 px-6 py-6 sm:px-8">
          {appt.status === "cancelled" ? (
            <Link href={`/${locale}/booking`} className="btn-primary w-full">{t.booking.bookAnother}</Link>
          ) : isPast ? (
            <p className="text-sm text-mocha">{tm.past}</p>
          ) : (
            <ManageActions
              locale={locale}
              token={appt.manage_token}
              t={{ manage: tm, booking: t.booking, daysShort: t.hours.daysShort }}
              canCancel={cancel.ok}
              canReschedule={reschedule.ok}
              lockedText={fmt(tm.policyLocked, { hours: Math.max(salon.cancellation_window_hours, salon.reschedule_window_hours) })}
              salonPhone={appt.branch.phone ?? salon.phone}
              query={{
                branchId: appt.branch.id,
                serviceIds: appt.services.map((s) => s.service_id).filter((x): x is string => !!x),
                employeeId: appt.employee_was_requested ? appt.employee.id : null,
                token: appt.manage_token,
              }}
              today={toDateKey(new Date(), salon.timezone)}
              maxAdvanceDays={salon.max_advance_days}
            />
          )}
          <p className="mt-5 text-xs leading-relaxed text-taupe">{pick(salon.cancellation_policy, locale)}</p>
        </div>
      </div>
    </div>
  );
}
