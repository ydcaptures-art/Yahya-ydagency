import "server-only";
import { cache } from "react";
import { sql } from "./db";
import type { Localized } from "@/i18n/config";

export type Salon = {
  id: string;
  slug: string;
  name: string;
  tagline: Localized;
  about: Localized;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram_url: string | null;
  instagram_handle: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  trust_stats: { rating?: number; reviews?: number; clients?: number; years?: number };
  currency: string;
  timezone: string;
  phone_country_code: string;
  default_locale: string;
  slot_interval_minutes: number;
  min_lead_minutes: number;
  max_advance_days: number;
  cancellation_window_hours: number;
  reschedule_window_hours: number;
  auto_confirm: boolean;
  booking_policy: Localized;
  cancellation_policy: Localized;
  notify_email: boolean;
  notify_whatsapp: boolean;
  reminder_hours_before: number;
  staff_notification_email: string | null;
};

export type BranchHour = {
  weekday: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
};

export type Branch = {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  phone: string | null;
  email: string | null;
  map_url: string | null;
  image_url: string | null;
  description: Localized;
  is_active: boolean;
  sort_order: number;
  hours: BranchHour[];
};

export type Category = {
  id: string;
  slug: string;
  name: Localized;
  description: Localized;
  sort_order: number;
};

export type Service = {
  id: string;
  category_id: string;
  name: Localized;
  description: Localized;
  price_cents: number;
  price_is_from: boolean;
  duration_minutes: number;
  buffer_minutes: number;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  branch_ids: string[];
};

export type Employee = {
  id: string;
  branch_id: string;
  first_name: string;
  last_name: string;
  title: Localized;
  bio: Localized;
  photo_url: string | null;
  is_active: boolean;
  is_bookable: boolean;
  sort_order: number;
  service_ids: string[];
};

/** The tenant served by this deployment. Cached per request. */
export const getSalon = cache(async (): Promise<Salon> => {
  const slug = process.env.SALON_SLUG || "maison-aurelle";
  const rows = await sql<Salon[]>`select * from salons where slug = ${slug}`;
  if (!rows[0]) throw new Error(`Salon "${slug}" not found. Run the seed or set SALON_SLUG.`);
  return rows[0];
});

export const getBranches = cache(async (salonId: string, activeOnly = true): Promise<Branch[]> => {
  return sql<Branch[]>`
    select b.*,
      coalesce((select json_agg(json_build_object(
        'weekday', h.weekday, 'is_closed', h.is_closed,
        'open_time', to_char(h.open_time, 'HH24:MI'), 'close_time', to_char(h.close_time, 'HH24:MI'))
        order by h.weekday) from branch_hours h where h.branch_id = b.id), '[]') as hours
    from branches b
    where b.salon_id = ${salonId} ${activeOnly ? sql`and b.is_active` : sql``}
    order by b.sort_order, b.name`;
});

export const getCategories = cache(async (salonId: string): Promise<Category[]> => {
  return sql<Category[]>`select id, slug, name, description, sort_order from service_categories
    where salon_id = ${salonId} order by sort_order, slug`;
});

export const getServices = cache(async (salonId: string, activeOnly = true): Promise<Service[]> => {
  return sql<Service[]>`
    select s.id, s.category_id, s.name, s.description, s.price_cents, s.price_is_from, s.duration_minutes,
      s.buffer_minutes, s.image_url, s.is_active, s.is_featured, s.sort_order,
      coalesce(array_agg(bs.branch_id) filter (where bs.branch_id is not null), '{}') as branch_ids
    from services s
    left join branch_services bs on bs.service_id = s.id
    left join service_categories c on c.id = s.category_id
    where s.salon_id = ${salonId} ${activeOnly ? sql`and s.is_active` : sql``}
    group by s.id, c.sort_order
    order by c.sort_order, s.sort_order, s.name->>'en'`;
});

export const getEmployees = cache(async (salonId: string, activeOnly = true): Promise<Employee[]> => {
  return sql<Employee[]>`
    select e.id, e.branch_id, e.first_name, e.last_name, e.title, e.bio, e.photo_url, e.is_active, e.is_bookable,
      e.sort_order,
      coalesce(array_agg(es.service_id) filter (where es.service_id is not null), '{}') as service_ids
    from employees e
    left join employee_services es on es.employee_id = e.id
    where e.salon_id = ${salonId} ${activeOnly ? sql`and e.is_active` : sql``}
    group by e.id
    order by e.sort_order, e.first_name`;
});

export type PublicContent = {
  offers: { id: string; title: Localized; description: Localized; badge: Localized; image_url: string | null; valid_until: string | null }[];
  testimonials: { id: string; author: string; body: Localized; rating: number; service_label: Localized }[];
  gallery: { id: string; kind: "gallery" | "before_after"; image_url: string; before_image_url: string | null; caption: Localized }[];
};

export const getPublicContent = cache(async (salonId: string): Promise<PublicContent> => {
  const [offers, testimonials, gallery] = await Promise.all([
    sql<PublicContent["offers"]>`select id, title, description, badge, image_url, to_char(valid_until, 'YYYY-MM-DD') as valid_until
      from offers where salon_id = ${salonId} and is_active and (valid_until is null or valid_until >= current_date)
      order by sort_order`,
    sql<PublicContent["testimonials"]>`select id, author, body, rating, service_label from testimonials
      where salon_id = ${salonId} and is_active order by sort_order`,
    sql<PublicContent["gallery"]>`select id, kind, image_url, before_image_url, caption from gallery_items
      where salon_id = ${salonId} order by kind, sort_order`,
  ]);
  return { offers, testimonials, gallery };
});
