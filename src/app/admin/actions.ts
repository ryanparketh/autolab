"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { login, logout, requireAdmin } from "@/lib/auth";
import {
  BookingError,
  cancelBooking,
  createAdminBooking,
  markDepositPaidOffline,
  rescheduleBooking,
  setBookingStatus,
} from "@/lib/bookings";
import { category, contactSchema, vehicleSize, vehicleSchema } from "@/lib/validation";
import { Prisma } from "@/generated/prisma/client";

export type ActionState = { error?: string; ok?: string } | null;

function fail(err: unknown): ActionState {
  if (err instanceof BookingError) return { error: err.message };
  if (err instanceof z.ZodError) {
    const i = err.issues[0];
    return { error: `${i.path.join(".") || "Input"}: ${i.message}` };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return { error: "That value is already in use (must be unique)." };
  }
  // Stripe errors carry a user-safe message.
  if (err && typeof err === "object" && "type" in err && String((err as { type: string }).type).startsWith("Stripe")) {
    return { error: `Stripe: ${(err as unknown as Error).message}` };
  }
  console.error("[admin action]", err);
  return { error: "Something went wrong. Check the server logs." };
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

/** "$1,234.50" → 123450 */
function dollarsToCents(v: string): number {
  const n = Number(v.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new BookingError(`Invalid amount: ${v || "(empty)"}`);
  return Math.round(n * 100);
}

function refresh() {
  revalidatePath("/", "layout");
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const res = await login(str(fd, "email"), String(fd.get("password") ?? ""));
  if (!res.ok) return { error: res.error };
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

// ─── Bookings ────────────────────────────────────────────────────────────────

export async function bookingStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const status = z.enum(["IN_PROGRESS", "COMPLETED", "NO_SHOW", "CONFIRMED"]).parse(str(fd, "status"));
    await setBookingStatus(str(fd, "id"), status);
    refresh();
    return { ok: "Status updated." };
  } catch (e) {
    return fail(e);
  }
}

export async function rescheduleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await rescheduleBooking(str(fd, "id"), str(fd, "localStart"), bool(fd, "force"));
    refresh();
    return { ok: "Rescheduled. The customer was sent an updated confirmation." };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await cancelBooking(str(fd, "id"), bool(fd, "refund"), bool(fd, "notify"));
    refresh();
    return { ok: "Booking cancelled." };
  } catch (e) {
    return fail(e);
  }
}

export async function markPaidAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await markDepositPaidOffline(str(fd, "id"));
    refresh();
    return { ok: "Deposit marked as paid and booking confirmed." };
  } catch (e) {
    return fail(e);
  }
}

export async function bookingNotesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await db.booking.update({
      where: { id: str(fd, "id") },
      data: { adminNotes: str(fd, "adminNotes").slice(0, 5000) || null },
    });
    refresh();
    return { ok: "Notes saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function createBookingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  let id: string;
  try {
    const contact = contactSchema.parse({
      name: str(fd, "name"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      smsOptIn: bool(fd, "smsOptIn"),
    });
    const vehicle = vehicleSchema.parse({
      year: str(fd, "year"),
      make: str(fd, "make"),
      model: str(fd, "model"),
      color: str(fd, "color"),
      size: str(fd, "size"),
    });
    const duration = str(fd, "durationMinutes");
    const b = await createAdminBooking({
      contact,
      vehicle: { ...vehicle, color: vehicle.color || undefined },
      serviceId: str(fd, "serviceId"),
      localStart: `${str(fd, "date")}T${str(fd, "time")}`,
      durationMinutes: duration ? Number(duration) : undefined,
      priceCents: dollarsToCents(str(fd, "price")),
      depositCents: dollarsToCents(str(fd, "deposit") || "0"),
      paymentMode: str(fd, "paymentMode") === "link" ? "link" : "none",
      force: bool(fd, "force"),
      quoteId: str(fd, "quoteId") || undefined,
      notes: str(fd, "notes") || undefined,
    });
    id = b.id;
  } catch (e) {
    return fail(e);
  }
  refresh();
  redirect(`/admin/bookings/${id}`);
}

// ─── Quotes ──────────────────────────────────────────────────────────────────

export async function quoteStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const status = z.enum(["NEW", "CONTACTED", "CLOSED"]).parse(str(fd, "status"));
    await db.quoteRequest.update({ where: { id: str(fd, "id") }, data: { status } });
    refresh();
    return { ok: "Updated." };
  } catch (e) {
    return fail(e);
  }
}

// ─── Customers ───────────────────────────────────────────────────────────────

export async function customerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const c = contactSchema.parse({
      name: str(fd, "name"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      smsOptIn: bool(fd, "smsOptIn"),
    });
    await db.customer.update({
      where: { id: str(fd, "id") },
      data: { ...c, notes: str(fd, "notes").slice(0, 5000) || null },
    });
    refresh();
    return { ok: "Customer saved." };
  } catch (e) {
    return fail(e);
  }
}

// ─── Services & add-ons ──────────────────────────────────────────────────────

const SIZES = vehicleSize.options;

export async function serviceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  let savedId: string;
  const id = str(fd, "id");
  try {
    const bookingMode = z.enum(["INSTANT", "QUOTE"]).parse(str(fd, "bookingMode"));
    const depositType = z.enum(["FLAT", "PERCENT"]).parse(str(fd, "depositType"));
    const depositRaw = str(fd, "depositValue");
    const depositValue =
      depositType === "FLAT" ? dollarsToCents(depositRaw) : z.coerce.number().int().min(0).max(100).parse(depositRaw);
    const days = str(fd, "durationDays");
    const data = {
      slug: z
        .string()
        .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers and dashes")
        .parse(str(fd, "slug")),
      category: category.parse(str(fd, "category")),
      name: z.string().min(1).max(100).parse(str(fd, "name")),
      tagline: z.string().max(200).parse(str(fd, "tagline")),
      description: z.string().max(2000).parse(str(fd, "description")),
      features: str(fd, "features")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20),
      bookingMode,
      durationDays: days ? z.coerce.number().int().min(1).max(30).parse(days) : null,
      startingAtCents: str(fd, "startingAt") ? dollarsToCents(str(fd, "startingAt")) : null,
      depositType,
      depositValue,
      popular: bool(fd, "popular"),
      active: bool(fd, "active"),
      sortOrder: z.coerce
        .number()
        .int()
        .parse(str(fd, "sortOrder") || "0"),
    };

    const prices = SIZES.flatMap((size) => {
      const p = str(fd, `price_${size}`);
      if (!p) return [];
      const mins = str(fd, `mins_${size}`);
      return [
        {
          vehicleSize: size,
          priceCents: dollarsToCents(p),
          durationMinutes: data.durationDays ? 0 : z.coerce.number().int().min(15).max(720).parse(mins),
        },
      ];
    });
    if (bookingMode === "INSTANT" && prices.length === 0) {
      throw new BookingError("Instant-book services need at least one vehicle-size price.");
    }

    savedId = await db.$transaction(async (tx) => {
      const svc = id ? await tx.service.update({ where: { id }, data }) : await tx.service.create({ data });
      await tx.servicePrice.deleteMany({ where: { serviceId: svc.id } });
      if (prices.length) {
        await tx.servicePrice.createMany({ data: prices.map((p) => ({ ...p, serviceId: svc.id })) });
      }
      return svc.id;
    });
  } catch (e) {
    return fail(e);
  }
  refresh();
  if (!id) redirect(`/admin/services/${savedId}`);
  return { ok: "Service saved." };
}

export async function addOnAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const id = str(fd, "id");
    const data = {
      name: z.string().min(1).max(100).parse(str(fd, "name")),
      description: z.string().max(500).parse(str(fd, "description")),
      priceCents: dollarsToCents(str(fd, "price")),
      durationMinutes: z.coerce
        .number()
        .int()
        .min(0)
        .max(480)
        .parse(str(fd, "durationMinutes") || "0"),
      categories: fd.getAll("categories").map((c) => category.parse(String(c))),
      active: bool(fd, "active"),
      sortOrder: z.coerce
        .number()
        .int()
        .parse(str(fd, "sortOrder") || "0"),
    };
    if (id) await db.addOn.update({ where: { id }, data });
    else await db.addOn.create({ data });
    refresh();
    return { ok: "Add-on saved." };
  } catch (e) {
    return fail(e);
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function settingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const data = z
      .object({
        bayCount: z.coerce.number().int().min(1).max(50),
        slotIntervalMin: z.coerce
          .number()
          .int()
          .refine((n) => [15, 30, 60].includes(n), "Must be 15, 30 or 60"),
        minLeadHours: z.coerce
          .number()
          .int()
          .min(0)
          .max(24 * 14),
        bookingWindowDays: z.coerce.number().int().min(1).max(365),
      })
      .parse(Object.fromEntries(fd));
    await db.settings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });

    const toMin = (t: string) => {
      const m = /^(\d{2}):(\d{2})$/.exec(t);
      if (!m) throw new BookingError(`Invalid time "${t}"`);
      return Number(m[1]) * 60 + Number(m[2]);
    };
    for (let d = 1; d <= 7; d++) {
      const isOpen = bool(fd, `open_${d}`);
      const openMinute = toMin(str(fd, `from_${d}`) || "08:00");
      const closeMinute = toMin(str(fd, `to_${d}`) || "18:00");
      if (isOpen && closeMinute <= openMinute) throw new BookingError("Closing time must be after opening time.");
      await db.businessHours.upsert({
        where: { weekday: d },
        update: { isOpen, openMinute, closeMinute },
        create: { weekday: d, isOpen, openMinute, closeMinute },
      });
    }
    refresh();
    return { ok: "Settings saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function addClosedDateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const date = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
      .parse(str(fd, "date"));
    const reason = str(fd, "reason").slice(0, 100) || null;
    await db.closedDate.upsert({ where: { date }, update: { reason }, create: { date, reason } });
    const dayStart = DateTime.fromISO(date, { zone: env.timezone }).startOf("day");
    const clashes = await db.booking.count({
      where: {
        status: { in: ["CONFIRMED", "PENDING_PAYMENT", "IN_PROGRESS"] },
        startAt: { lt: dayStart.plus({ days: 1 }).toJSDate() },
        endAt: { gt: dayStart.toJSDate() },
      },
    });
    refresh();
    return {
      ok: clashes
        ? `Closed ${date}. ⚠ ${clashes} existing booking(s) fall on this date — contact and reschedule them.`
        : `Closed ${date}.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function removeClosedDateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await db.closedDate.delete({ where: { date: str(fd, "date") } });
    refresh();
    return { ok: "Removed." };
  } catch (e) {
    return fail(e);
  }
}
