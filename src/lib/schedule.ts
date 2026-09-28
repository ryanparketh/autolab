import "server-only";
import { DateTime } from "luxon";
import { db } from "./db";
import { env } from "./env";
import type { Interval, ScheduleConfig } from "./availability";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient | typeof db;

/** Statuses that occupy a bay. PENDING_PAYMENT only counts while its hold is live. */
export const OCCUPYING = ["CONFIRMED", "IN_PROGRESS"] as const;

export async function loadScheduleConfig(tx: Tx = db): Promise<ScheduleConfig> {
  const [settings, hours, closed] = await Promise.all([
    tx.settings.findUnique({ where: { id: 1 } }),
    tx.businessHours.findMany(),
    tx.closedDate.findMany({
      where: { date: { gte: DateTime.now().setZone(env.timezone).toISODate()! } },
    }),
  ]);
  const byDay: ScheduleConfig["hours"] = {};
  for (let d = 1; d <= 7; d++) byDay[d] = { isOpen: false, openMinute: 0, closeMinute: 0 };
  for (const h of hours) byDay[h.weekday] = h;
  return {
    timezone: env.timezone,
    bayCount: settings?.bayCount ?? 1,
    slotIntervalMin: settings?.slotIntervalMin ?? 30,
    minLeadHours: settings?.minLeadHours ?? 12,
    bookingWindowDays: settings?.bookingWindowDays ?? 60,
    hours: byDay,
    closedDates: new Set(closed.map((c) => c.date)),
  };
}

/** Bay-occupying intervals overlapping [from, to). */
export async function loadBusy(
  from: Date,
  to: Date,
  opts: { excludeBookingId?: string; tx?: Tx } = {},
): Promise<Interval[]> {
  const tx = opts.tx ?? db;
  const now = new Date();
  const rows = await tx.booking.findMany({
    where: {
      id: opts.excludeBookingId ? { not: opts.excludeBookingId } : undefined,
      startAt: { lt: to },
      endAt: { gt: from },
      OR: [{ status: { in: [...OCCUPYING] } }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }],
    },
    select: { startAt: true, endAt: true },
  });
  return rows.map((r) => ({ start: r.startAt.getTime(), end: r.endAt.getTime() }));
}

/** Serialises all booking writes. A small shop does a handful of bookings per
 * day, so a single global lock is simpler and safer than finer-grained locking,
 * and it makes double-booking the last bay impossible. */
export async function lockSchedule(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(724113)`;
}
