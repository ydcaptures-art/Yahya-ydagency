import { adminContext } from "@/lib/admin";
import { can } from "@/lib/auth";
import { getBranches, getCategories, getEmployees, getServices } from "@/lib/catalog";
import { pick } from "@/i18n/config";
import { formatMoney } from "@/lib/money";
import { toDateKey } from "@/lib/time";
import { PageHeader, Flash } from "@/components/admin/ui";
import { NewAppointmentForm } from "@/components/admin/NewAppointmentForm";
import { createAppointmentAction } from "../actions";

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { user, salon, locale, t, dict } = await adminContext();
  const [branches, categories, services, employees] = await Promise.all([
    getBranches(salon.id), getCategories(salon.id), getServices(salon.id), getEmployees(salon.id),
  ]);
  const ta = t.appointments;
  const errors: Record<string, string> = {
    conflict: ta.conflict, invalid: dict.booking.genericError, no_eligible_employee: dict.booking.noProfessional,
    invalid_employee: ta.conflict, invalid_services: dict.booking.genericError,
  };
  return (
    <>
      <PageHeader title={ta.newTitle} />
      <Flash error={sp.error ? errors[sp.error] ?? dict.booking.genericError : undefined} savedText="" />
      <NewAppointmentForm
        action={createAppointmentAction}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        services={services.map((s) => ({
          id: s.id, name: pick(s.name, locale), category: pick(categories.find((c) => c.id === s.category_id)?.name, locale),
          duration: s.duration_minutes, price: formatMoney(s.price_cents, salon.currency, locale), branch_ids: s.branch_ids,
        }))}
        employees={employees.map((e) => ({ id: e.id, name: `${e.first_name} ${e.last_name}`, branch_id: e.branch_id, service_ids: e.service_ids }))}
        today={toDateKey(new Date(), salon.timezone)}
        lockEmployeeId={can.manageAllAppointments(user) ? null : user.employee_id}
        t={{
          branch: t.common.branch, employee: t.common.employee, any: dict.booking.anyProfessional, services: t.common.services,
          date: t.common.date, time: t.common.time, pickSlot: ta.pickSlot, noSlots: dict.booking.noSlots, override: ta.allowOutsideHours,
          customer: t.common.customer, phone: t.common.phone, firstName: dict.booking.firstName, lastName: dict.booking.lastName,
          email: t.common.email, source: ta.source, notes: ta.internalNotes, notify: ta.notifyCustomer, create: t.common.create,
        }}
      />
    </>
  );
}
