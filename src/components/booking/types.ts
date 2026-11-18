import type { BranchHour } from "@/lib/catalog";

export type WizardBranch = {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string | null;
  image_url: string | null;
  description: string;
  hours: BranchHour[];
};
export type WizardCategory = { id: string; name: string };
export type WizardService = {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price_cents: number;
  price_is_from: boolean;
  duration_minutes: number;
  image_url: string | null;
  branch_ids: string[];
};
export type WizardEmployee = {
  id: string;
  branch_id: string;
  name: string;
  title: string;
  bio: string;
  photo_url: string | null;
  service_ids: string[];
};
export type WizardSalon = {
  name: string;
  currency: string;
  timezone: string;
  phone: string | null;
  maxAdvanceDays: number;
  bookingPolicy: string;
  cancellationPolicy: string;
  today: string;
};
export type DaySlots = { date: string; open: boolean; slots: { time: string; startsAt: string; available: boolean }[] };
