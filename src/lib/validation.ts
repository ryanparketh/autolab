import { z } from "zod";

export const vehicleSize = z.enum(["COUPE_SEDAN", "SMALL_SUV", "LARGE_SUV_TRUCK", "EXOTIC"]);
export const category = z.enum(["DETAILING", "WINDOW_TINT", "PPF", "CERAMIC_COATING"]);

const currentYear = new Date().getFullYear();

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const phone = z
  .string()
  .trim()
  .transform((s) => s.replace(/[^\d+]/g, ""))
  .refine((s) => /^\+?1?\d{10}$/.test(s), "Enter a valid US phone number");

export const contactSchema = z.object({
  name: trimmed(100),
  email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(200)),
  phone,
  smsOptIn: z.boolean().default(false),
});

export const vehicleSchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(1950)
    .max(currentYear + 2),
  make: trimmed(50),
  model: trimmed(80),
  color: z.string().trim().max(40).optional().or(z.literal("")),
  size: vehicleSize,
});

export const availabilityQuery = z.object({
  serviceId: z.string().min(1).max(50),
  size: vehicleSize,
  addOns: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").filter(Boolean).slice(0, 20) : [])),
});

export const createBookingSchema = z.object({
  serviceId: z.string().min(1).max(50),
  addOnIds: z.array(z.string().min(1).max(50)).max(20).default([]),
  startAt: z.iso.datetime({ offset: true }),
  contact: contactSchema,
  vehicle: vehicleSchema,
  notes: z.string().trim().max(1000).optional(),
  acceptPolicy: z.literal(true, { error: "Please accept the booking policy" }),
  // Honeypot: real users never see or fill this field.
  website: z.string().max(500).optional(),
});

export const quoteRequestSchema = z.object({
  category,
  serviceId: z.string().max(50).optional().or(z.literal("")),
  contact: contactSchema,
  vehicle: vehicleSchema.omit({ color: true }),
  message: z.string().trim().max(2000).optional(),
  website: z.string().max(500).optional(),
});

/** Normalise a US phone to E.164 for SMS. */
export function toE164(p: string): string {
  const digits = p.replace(/\D/g, "");
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}
