import { z } from "zod";
import { locales } from "@/i18n/config";

/** Normalise a phone number to E.164 ("+905321234567"). Returns null if invalid. */
export function normalizePhone(input: string, defaultCountryCode: string): string | null {
  let raw = input.trim().replace(/[\s().\-/]/g, "");
  if (raw.startsWith("00")) raw = "+" + raw.slice(2);
  if (!raw.startsWith("+")) {
    raw = raw.replace(/^0+/, "");
    raw = "+" + defaultCountryCode + raw;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(raw)) return null;
  return raw;
}

const uuid = z.string().uuid();
const name = z.string().trim().min(1).max(80);

export const customerSchema = z.object({
  firstName: name,
  lastName: name,
  phone: z.string().trim().min(6).max(25),
  email: z.string().trim().toLowerCase().email().max(200).optional().or(z.literal("").transform(() => undefined)),
  notes: z.string().trim().max(1000).optional(),
});

export const availabilityQuerySchema = z.object({
  branchId: uuid,
  serviceIds: z.array(uuid).min(1).max(8),
  employeeId: uuid.nullable().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.coerce.number().int().min(1).max(62).default(1),
  excludeToken: z.string().max(100).optional(),
});

export const bookingRequestSchema = z.object({
  branchId: uuid,
  serviceIds: z.array(uuid).min(1).max(8),
  employeeId: uuid.nullable(),
  startsAt: z.string().datetime(),
  locale: z.enum(locales),
  customer: customerSchema,
  acceptPolicy: z.literal(true),
  // Honeypot: real users never fill this hidden field
  website: z.string().max(0).optional(),
});

export type BookingRequest = z.infer<typeof bookingRequestSchema>;
