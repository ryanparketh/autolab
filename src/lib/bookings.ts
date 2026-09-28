import "server-only";
import { randomInt } from "node:crypto";
import { DateTime } from "luxon";
import type Stripe from "stripe";
import { db } from "./db";
import { env } from "./env";
import {
  fits,
  intervalForStart,
  isBookable,
  multiDayInterval,
  withinBookingWindow,
  type Interval,
  type JobLength,
} from "./availability";
import { quote } from "./pricing";
import { loadBusy, loadScheduleConfig, lockSchedule } from "./schedule";
import {
  CHECKOUT_TTL_LINK_MIN,
  CHECKOUT_TTL_ONLINE_MIN,
  HOLD_GRACE_MIN,
  createDepositCheckout,
  stripe,
  stripeConfigured,
} from "./stripe";
import { notifyBookingConfirmed, notifyCancelled, notifyPaymentLink } from "./notify";
import type { Prisma, VehicleSize } from "@/generated/prisma/client";

export class BookingError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
function newReference() {
  let s = "AL-";
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return s;
}

const bookingNoticeInclude = {
  customer: { select: { name: true, email: true, phone: true, smsOptIn: true } },
  vehicle: { select: { year: true, make: true, model: true } },
} satisfies Prisma.BookingInclude;

type Tx = Prisma.TransactionClient;

type ContactInput = { name: string; email: string; phone: string; smsOptIn: boolean };
type VehicleInput = { year: number; make: string; model: string; color?: string; size: VehicleSize };

/** Find or create the customer. Existing customers' details are never silently
 * overwritten from a public form (anyone can type anyone's email) — differences
 * are surfaced to the shop in a note instead. */
async function upsertCustomer(tx: Tx, c: ContactInput) {
  const existing = await tx.customer.findUnique({ where: { email: c.email } });
  if (!existing) {
    return { customer: await tx.customer.create({ data: c }), note: null as string | null };
  }
  const notes: string[] = [];
  if (existing.phone !== c.phone) notes.push(`phone given at booking: ${c.phone}`);
  if (existing.name.toLowerCase() !== c.name.toLowerCase()) notes.push(`name given at booking: ${c.name}`);
  // Opt-in only applies to the number already on file.
  if (c.smsOptIn && !existing.smsOptIn && existing.phone === c.phone) {
    await tx.customer.update({ where: { id: existing.id }, data: { smsOptIn: true } });
  }
  return { customer: existing, note: notes.length ? `Contact differs from file — ${notes.join("; ")}` : null };
}

async function findOrCreateVehicle(tx: Tx, customerId: string, v: VehicleInput) {
  const existing = await tx.vehicle.findFirst({
    where: {
      customerId,
      year: v.year,
      make: { equals: v.make, mode: "insensitive" },
      model: { equals: v.model, mode: "insensitive" },
    },
  });
  if (existing) return existing;
  return tx.vehicle.create({
    data: { customerId, year: v.year, make: v.make, model: v.model, color: v.color || null, size: v.size },
  });
}

async function createWithUniqueReference(tx: Tx, data: Omit<Prisma.BookingUncheckedCreateInput, "reference">) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = newReference();
    const clash = await tx.booking.findUnique({ where: { reference }, select: { id: true } });
    if (!clash) return tx.booking.create({ data: { ...data, reference } });
  }
  throw new Error("Could not allocate a booking reference");
}

// ─── Online booking ──────────────────────────────────────────────────────────

export type OnlineBookingInput = {
  serviceId: string;
  addOnIds: string[];
  startAt: string;
  contact: ContactInput;
  vehicle: VehicleInput;
  notes?: string;
};

export async function createOnlineBooking(input: OnlineBookingInput): Promise<{ redirectUrl: string }> {
  if (env.isProd && !stripeConfigured()) {
    throw new BookingError("Online payments are not configured. Please call to book.", 503);
  }

  const service = await db.service.findFirst({
    where: { id: input.serviceId, active: true, bookingMode: "INSTANT" },
    include: { prices: { where: { vehicleSize: input.vehicle.size } } },
  });
  const price = service?.prices[0];
  if (!service || !price) throw new BookingError("That service isn't available for online booking.");

  const addOnIds = [...new Set(input.addOnIds)];
  const addOns = await db.addOn.findMany({
    where: { id: { in: addOnIds }, active: true, categories: { has: service.category } },
  });
  if (addOns.length !== addOnIds.length) throw new BookingError("One of the selected add-ons isn't available.");

  const q = quote(price, addOns, service);
  const length: JobLength = service.durationDays
    ? { kind: "days", days: service.durationDays }
    : { kind: "minutes", minutes: q.minutes };

  const start = Date.parse(input.startAt);
  const needsPayment = q.depositCents > 0 && stripeConfigured();
  const holdMinutes = CHECKOUT_TTL_ONLINE_MIN + HOLD_GRACE_MIN;

  const booking = await db.$transaction(async (tx) => {
    await lockSchedule(tx);
    const cfg = await loadScheduleConfig(tx);
    const iv = intervalForStart(start, length, cfg);
    if (!iv) throw new BookingError("That time isn't a valid appointment slot.");
    if (!withinBookingWindow(iv.start, cfg, Date.now())) {
      throw new BookingError("That time can no longer be booked online. Please pick another time or call us.");
    }
    const busy = await loadBusy(new Date(iv.start), new Date(iv.end), { tx });
    if (!isBookable(start, length, busy, cfg, Date.now())) {
      throw new BookingError("Sorry — that slot was just taken. Please pick another time.", 409);
    }

    const { customer, note } = await upsertCustomer(tx, input.contact);
    const vehicle = await findOrCreateVehicle(tx, customer.id, input.vehicle);

    return createWithUniqueReference(tx, {
      status: needsPayment ? "PENDING_PAYMENT" : "CONFIRMED",
      source: "ONLINE",
      customerId: customer.id,
      vehicleId: vehicle.id,
      serviceId: service.id,
      serviceName: service.name,
      vehicleSize: input.vehicle.size,
      startAt: new Date(iv.start),
      endAt: new Date(iv.end),
      priceCents: q.totalCents,
      depositCents: q.depositCents,
      holdExpiresAt: needsPayment ? new Date(Date.now() + holdMinutes * 60_000) : null,
      customerNotes: input.notes || null,
      adminNotes:
        [note, q.depositCents > 0 && !needsPayment ? "DEV: Stripe not configured — deposit NOT collected." : null]
          .filter(Boolean)
          .join("\n") || null,
      addOns: {
        create: addOns.map((a) => ({ addOnId: a.id, name: a.name, priceCents: a.priceCents })),
      },
    });
  });

  if (!needsPayment) {
    await sendConfirmation(booking.id);
    return { redirectUrl: `/book/success?ref=${booking.reference}` };
  }

  try {
    const session = await createDepositCheckout({
      bookingId: booking.id,
      reference: booking.reference,
      serviceName: service.name,
      depositCents: q.depositCents,
      customerEmail: input.contact.email,
      ttlMinutes: CHECKOUT_TTL_ONLINE_MIN,
    });
    await db.booking.update({ where: { id: booking.id }, data: { stripeCheckoutSessionId: session.id } });
    if (!session.url) throw new Error("Stripe returned no checkout URL");
    return { redirectUrl: session.url };
  } catch (err) {
    // Release the slot so a Stripe outage doesn't leave phantom holds.
    await db.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED", holdExpiresAt: null } });
    console.error("[booking] checkout creation failed", err);
    throw new BookingError("We couldn't start the payment. Please try again or call us.", 502);
  }
}

async function sendConfirmation(bookingId: string) {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: bookingNoticeInclude });
  if (b) await notifyBookingConfirmed(b);
}

// ─── Stripe outcomes ─────────────────────────────────────────────────────────

/** Idempotent: safe to call from both the webhook and the success page. */
export async function confirmFromCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId || session.payment_status !== "paid") return;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

  const { count } = await db.booking.updateMany({
    where: { id: bookingId, status: "PENDING_PAYMENT" },
    data: {
      status: "CONFIRMED",
      depositPaidAt: new Date(),
      stripePaymentIntentId: paymentIntentId,
      stripeCheckoutSessionId: session.id,
      holdExpiresAt: null,
    },
  });
  if (count === 1) {
    await sendConfirmation(bookingId);
    return;
  }

  // Money arrived for a booking that is no longer pending (e.g. cancelled by the
  // shop meanwhile). Never lose track of a payment: record it and flag it.
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (b && !b.depositPaidAt && (b.status === "EXPIRED" || b.status === "CANCELLED")) {
    await db.booking.update({
      where: { id: bookingId },
      data: {
        depositPaidAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
        adminNotes: `${b.adminNotes ? b.adminNotes + "\n" : ""}⚠ Deposit paid after booking was ${b.status.toLowerCase()} — refund or reinstate.`,
      },
    });
    console.warn(`[booking] payment received for ${b.status} booking ${b.reference}`);
  }
}

export async function expireFromCheckout(sessionId: string): Promise<void> {
  await db.booking.updateMany({
    where: { stripeCheckoutSessionId: sessionId, status: "PENDING_PAYMENT" },
    data: { status: "EXPIRED", holdExpiresAt: null },
  });
}

/** Customer backed out of Stripe Checkout: kill the session and free the slot now
 * rather than waiting 30 minutes. If Stripe says it's already paid, keep it. */
export async function abandonCheckout(reference: string): Promise<void> {
  const b = await db.booking.findUnique({ where: { reference } });
  if (!b || b.status !== "PENDING_PAYMENT" || b.source !== "ONLINE" || !b.stripeCheckoutSessionId) return;
  try {
    const s = await stripe().checkout.sessions.expire(b.stripeCheckoutSessionId);
    if (s.status === "expired") await expireFromCheckout(s.id);
  } catch {
    // Already completed or expired — the webhook will reconcile.
  }
}

export async function releaseExpiredHolds(): Promise<number> {
  const { count } = await db.booking.updateMany({
    where: { status: "PENDING_PAYMENT", holdExpiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  return count;
}

// ─── Admin operations ────────────────────────────────────────────────────────

export type AdminBookingInput = {
  contact: ContactInput;
  vehicle: VehicleInput;
  serviceId: string;
  /** local "YYYY-MM-DDTHH:mm" in shop timezone */
  localStart: string;
  durationMinutes?: number;
  priceCents: number;
  depositCents: number;
  paymentMode: "link" | "none";
  force: boolean;
  quoteId?: string;
  notes?: string;
};

function adminInterval(
  localStart: string,
  service: { durationDays: number | null },
  minutes: number | undefined,
  cfg: Awaited<ReturnType<typeof loadScheduleConfig>>,
): Interval {
  const start = DateTime.fromISO(localStart, { zone: cfg.timezone });
  if (!start.isValid) throw new BookingError("Invalid date/time.");
  if (service.durationDays) {
    const iv = multiDayInterval(start.toISODate()!, service.durationDays, cfg);
    if (!iv) throw new BookingError("The shop is closed on that date.");
    // Admin may pick a later drop-off time than opening.
    return { start: Math.max(iv.start, start.toMillis()), end: iv.end };
  }
  if (!minutes || minutes <= 0) throw new BookingError("Duration is required for same-day services.");
  return { start: start.toMillis(), end: start.plus({ minutes }).toMillis() };
}

export async function createAdminBooking(input: AdminBookingInput) {
  const service = await db.service.findUnique({ where: { id: input.serviceId } });
  if (!service) throw new BookingError("Unknown service.");
  if (input.depositCents > input.priceCents) throw new BookingError("Deposit can't exceed the price.");
  const wantsLink = input.paymentMode === "link" && input.depositCents > 0;
  if (wantsLink && !stripeConfigured())
    throw new BookingError("Stripe isn't configured, so payment links can't be sent.");
  if (wantsLink && input.depositCents < 50) throw new BookingError("Stripe's minimum charge is $0.50.");

  const booking = await db.$transaction(async (tx) => {
    await lockSchedule(tx);
    const cfg = await loadScheduleConfig(tx);
    const iv = adminInterval(input.localStart, service, input.durationMinutes, cfg);
    if (!input.force) {
      const busy = await loadBusy(new Date(iv.start), new Date(iv.end), { tx });
      if (!fits(busy, iv, cfg.bayCount)) {
        throw new BookingError(
          "All bays are booked for part of that time. Tick “override capacity” to book anyway.",
          409,
        );
      }
    }
    const { customer, note } = await upsertCustomer(tx, input.contact);
    const vehicle = await findOrCreateVehicle(tx, customer.id, input.vehicle);
    const b = await createWithUniqueReference(tx, {
      status: wantsLink ? "PENDING_PAYMENT" : "CONFIRMED",
      source: input.quoteId ? "QUOTE" : "ADMIN",
      customerId: customer.id,
      vehicleId: vehicle.id,
      serviceId: service.id,
      serviceName: service.name,
      vehicleSize: input.vehicle.size,
      startAt: new Date(iv.start),
      endAt: new Date(iv.end),
      priceCents: input.priceCents,
      depositCents: input.depositCents,
      holdExpiresAt: wantsLink ? new Date(Date.now() + (CHECKOUT_TTL_LINK_MIN + HOLD_GRACE_MIN) * 60_000) : null,
      adminNotes: [note, input.notes].filter(Boolean).join("\n") || null,
    });
    if (input.quoteId) {
      await tx.quoteRequest.update({ where: { id: input.quoteId }, data: { status: "CONVERTED", bookingId: b.id } });
    }
    return b;
  });

  if (!wantsLink) {
    await sendConfirmation(booking.id);
    return booking;
  }

  try {
    const session = await createDepositCheckout({
      bookingId: booking.id,
      reference: booking.reference,
      serviceName: service.name,
      depositCents: input.depositCents,
      customerEmail: input.contact.email,
      ttlMinutes: CHECKOUT_TTL_LINK_MIN,
    });
    const b = await db.booking.update({
      where: { id: booking.id },
      data: { stripeCheckoutSessionId: session.id },
      include: bookingNoticeInclude,
    });
    await notifyPaymentLink(b, session.url!);
    return b;
  } catch (err) {
    await db.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED", holdExpiresAt: null } });
    console.error("[booking] admin checkout creation failed", err);
    throw new BookingError("Booking saved but the Stripe payment link failed, so it was released. Try again.", 502);
  }
}

export async function rescheduleBooking(id: string, localStart: string, force: boolean) {
  await db.$transaction(async (tx) => {
    await lockSchedule(tx);
    const b = await tx.booking.findUnique({ where: { id }, include: { service: true } });
    if (!b) throw new BookingError("Booking not found.", 404);
    if (!["PENDING_PAYMENT", "CONFIRMED"].includes(b.status)) {
      throw new BookingError(`Can't reschedule a ${b.status.toLowerCase().replace("_", " ")} booking.`);
    }
    const cfg = await loadScheduleConfig(tx);
    const minutes = Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60_000);
    const iv = adminInterval(localStart, b.service, minutes, cfg);
    if (!force) {
      const busy = await loadBusy(new Date(iv.start), new Date(iv.end), { tx, excludeBookingId: id });
      if (!fits(busy, iv, cfg.bayCount)) {
        throw new BookingError(
          "All bays are booked for part of that time. Tick “override capacity” to move it anyway.",
          409,
        );
      }
    }
    await tx.booking.update({
      where: { id },
      data: { startAt: new Date(iv.start), endAt: new Date(iv.end), reminderSentAt: null },
    });
  });
  await sendConfirmation(id);
}

export async function setBookingStatus(id: string, status: "IN_PROGRESS" | "COMPLETED" | "NO_SHOW" | "CONFIRMED") {
  const b = await db.booking.findUnique({ where: { id } });
  if (!b) throw new BookingError("Booking not found.", 404);
  if (b.status === "CANCELLED" || b.status === "EXPIRED") {
    throw new BookingError("Cancelled or expired bookings can't change status. Create a new booking instead.");
  }
  if (status === "CONFIRMED" && b.status === "PENDING_PAYMENT") {
    throw new BookingError("This booking is waiting on its deposit. Mark it paid or cancel it instead.");
  }
  await db.booking.update({ where: { id }, data: { status } });
}

/** For deposits taken in person (cash, card terminal). */
export async function markDepositPaidOffline(id: string) {
  const { count } = await db.booking.updateMany({
    where: { id, status: "PENDING_PAYMENT" },
    data: { status: "CONFIRMED", depositPaidAt: new Date(), holdExpiresAt: null },
  });
  if (count !== 1) throw new BookingError("Only bookings awaiting a deposit can be marked paid.");
  const b = await db.booking.findUnique({ where: { id } });
  if (b?.stripeCheckoutSessionId) {
    await stripe()
      .checkout.sessions.expire(b.stripeCheckoutSessionId)
      .catch(() => undefined);
  }
  await sendConfirmation(id);
}

export async function cancelBooking(id: string, refund: boolean, notifyCustomer: boolean) {
  const b = await db.booking.findUnique({ where: { id }, include: bookingNoticeInclude });
  if (!b) throw new BookingError("Booking not found.", 404);
  if (["CANCELLED", "EXPIRED", "COMPLETED"].includes(b.status)) {
    throw new BookingError(`Booking is already ${b.status.toLowerCase()}.`);
  }

  let refunded = false;
  if (refund && b.depositPaidAt && !b.depositRefundedAt) {
    if (!b.stripePaymentIntentId) {
      throw new BookingError("Deposit wasn't paid through Stripe — refund it manually, then cancel without refund.");
    }
    await stripe().refunds.create(
      { payment_intent: b.stripePaymentIntentId, reason: "requested_by_customer" },
      { idempotencyKey: `refund-${b.id}` },
    );
    refunded = true;
  }
  if (b.status === "PENDING_PAYMENT" && b.stripeCheckoutSessionId) {
    await stripe()
      .checkout.sessions.expire(b.stripeCheckoutSessionId)
      .catch(() => undefined);
  }

  await db.booking.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      holdExpiresAt: null,
      depositRefundedAt: refunded ? new Date() : undefined,
    },
  });
  if (notifyCustomer) await notifyCancelled(b, refunded);
}
