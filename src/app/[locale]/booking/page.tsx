import type { Metadata } from "next";
import { isLocale, pick } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { pageContext } from "@/lib/site";
import { getBranches, getCategories, getServices, getEmployees } from "@/lib/catalog";
import { toDateKey } from "@/lib/time";
import { BookingWizard } from "@/components/booking/BookingWizard";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: t.meta.bookingTitle, description: t.meta.bookingDescription, alternates: { canonical: `/${locale}/booking` } };
}

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ branch?: string; service?: string }>;
}) {
  const { locale, t, salon } = await pageContext(params);
  const sp = await searchParams;
  const [branches, categories, services, employees] = await Promise.all([
    getBranches(salon.id),
    getCategories(salon.id),
    getServices(salon.id),
    getEmployees(salon.id),
  ]);

  return (
    <div className="min-h-dvh bg-ivory pt-24 pb-32 lg:pt-32">
      <BookingWizard
        locale={locale}
        t={{ booking: t.booking, hours: t.hours, services: t.services, nav: t.nav }}
        salon={{
          name: salon.name,
          currency: salon.currency,
          timezone: salon.timezone,
          phone: salon.phone,
          maxAdvanceDays: salon.max_advance_days,
          bookingPolicy: pick(salon.booking_policy, locale),
          cancellationPolicy: pick(salon.cancellation_policy, locale),
          today: toDateKey(new Date(), salon.timezone),
        }}
        branches={branches.map((b) => ({
          id: b.id,
          name: b.name,
          address: b.address,
          city: b.city,
          phone: b.phone,
          image_url: b.image_url,
          description: pick(b.description, locale),
          hours: b.hours,
        }))}
        categories={categories.map((c) => ({ id: c.id, name: pick(c.name, locale) }))}
        services={services.map((s) => ({
          id: s.id,
          category_id: s.category_id,
          name: pick(s.name, locale),
          description: pick(s.description, locale),
          price_cents: s.price_cents,
          price_is_from: s.price_is_from,
          duration_minutes: s.duration_minutes,
          image_url: s.image_url,
          branch_ids: s.branch_ids,
        }))}
        employees={employees
          .filter((e) => e.is_bookable)
          .map((e) => ({
            id: e.id,
            branch_id: e.branch_id,
            name: `${e.first_name} ${e.last_name}`,
            title: pick(e.title, locale),
            bio: pick(e.bio, locale),
            photo_url: e.photo_url,
            service_ids: e.service_ids,
          }))}
        initialBranchId={sp.branch ?? null}
        initialServiceId={sp.service ?? null}
      />
    </div>
  );
}
