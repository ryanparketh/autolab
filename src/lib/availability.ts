// Pure scheduling engine. No database access here, so it's fully unit-testable.
//
// Model: the shop has `bayCount` bays. Every booking occupies one bay for the
// continuous interval [startAt, endAt). A new job fits if, at every instant of
// its interval, fewer than `bayCount` existing bookings overlap it.
//
// Same-day jobs start on a slot grid and must finish by closing time.
// Multi-day jobs (PPF, ceramic incl. cure) are dropped off at opening on day 1
// and occupy a bay continuously until closing on their last business day
// (the car sits in the bay overnight, so nights count as occupied).

import { DateTime } from "luxon";

export type Interval = { start: number; end: number }; // epoch ms, end exclusive

export type DayHours = { isOpen: boolean; openMinute: number; closeMinute: number };

export type ScheduleConfig = {
  timezone: string;
  bayCount: number;
  slotIntervalMin: number;
  minLeadHours: number;
  bookingWindowDays: number;
  /** keyed by ISO weekday 1 (Mon) .. 7 (Sun) */
  hours: Record<number, DayHours>;
  /** local dates "YYYY-MM-DD" the shop is closed */
  closedDates: Set<string>;
};

export type JobLength = { kind: "minutes"; minutes: number } | { kind: "days"; days: number };

/** Hard cap on how far we'll walk looking for business days, to avoid infinite loops
 * if the shop is configured as closed every day. */
const MAX_DAY_SCAN = 60;

export function localDay(date: string, tz: string): DateTime {
  const d = DateTime.fromISO(date, { zone: tz });
  if (!d.isValid || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date: ${date}`);
  }
  return d.startOf("day");
}

/** Opening hours for a local date, or null if the shop is closed that day. */
export function openWindow(date: string, cfg: ScheduleConfig): { open: DateTime; close: DateTime } | null {
  if (cfg.closedDates.has(date)) return null;
  const day = localDay(date, cfg.timezone);
  const h = cfg.hours[day.weekday];
  if (!h || !h.isOpen || h.closeMinute <= h.openMinute) return null;
  // set() works in local wall-clock time, so opening hours stay correct across DST changes.
  const open = day.set({ hour: Math.floor(h.openMinute / 60), minute: h.openMinute % 60 });
  const close = day.set({ hour: Math.floor(h.closeMinute / 60), minute: h.closeMinute % 60 });
  return { open, close };
}

/** Max number of intervals simultaneously active anywhere inside `window`. */
export function peakOverlap(busy: Interval[], window: Interval): number {
  const events: Array<[number, number]> = [];
  for (const b of busy) {
    const s = Math.max(b.start, window.start);
    const e = Math.min(b.end, window.end);
    if (s < e) {
      events.push([s, 1], [e, -1]);
    }
  }
  // Ends sort before starts at the same instant: back-to-back jobs don't collide.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0;
  let peak = 0;
  for (const [, delta] of events) {
    cur += delta;
    if (cur > peak) peak = cur;
  }
  return peak;
}

export function fits(busy: Interval[], candidate: Interval, bayCount: number): boolean {
  return peakOverlap(busy, candidate) < bayCount;
}

/** Interval for a multi-day job starting at `date`, or null if `date` is closed
 * or there aren't enough business days within the scan limit. */
export function multiDayInterval(date: string, days: number, cfg: ScheduleConfig): Interval | null {
  const first = openWindow(date, cfg);
  if (!first) return null;
  let remaining = days - 1;
  let lastClose = first.close;
  let cursor = localDay(date, cfg.timezone);
  let scanned = 0;
  while (remaining > 0) {
    cursor = cursor.plus({ days: 1 });
    if (++scanned > MAX_DAY_SCAN) return null;
    const w = openWindow(cursor.toISODate()!, cfg);
    if (w) {
      lastClose = w.close;
      remaining--;
    }
  }
  return { start: first.open.toMillis(), end: lastClose.toMillis() };
}

export function withinBookingWindow(start: number, cfg: ScheduleConfig, now: number): boolean {
  const earliest = now + cfg.minLeadHours * 3_600_000;
  const latest = DateTime.fromMillis(now, { zone: cfg.timezone })
    .startOf("day")
    .plus({ days: cfg.bookingWindowDays + 1 })
    .toMillis();
  return start >= earliest && start < latest;
}

/** All bookable start times (epoch ms) on a local date for a job of `length`. */
export function slotsForDate(
  date: string,
  length: JobLength,
  busy: Interval[],
  cfg: ScheduleConfig,
  now: number,
): number[] {
  if (length.kind === "days") {
    const iv = multiDayInterval(date, Math.max(1, length.days), cfg);
    if (!iv) return [];
    if (!withinBookingWindow(iv.start, cfg, now)) return [];
    return fits(busy, iv, cfg.bayCount) ? [iv.start] : [];
  }

  const w = openWindow(date, cfg);
  if (!w) return [];
  const dur = length.minutes * 60_000;
  const step = Math.max(5, cfg.slotIntervalMin) * 60_000;
  const out: number[] = [];
  for (let t = w.open.toMillis(); t + dur <= w.close.toMillis(); t += step) {
    if (!withinBookingWindow(t, cfg, now)) continue;
    if (fits(busy, { start: t, end: t + dur }, cfg.bayCount)) out.push(t);
  }
  return out;
}

/** Interval a job would occupy if it started at `start`, validating that
 * `start` is actually a legal slot. Used when creating a booking so we never
 * trust a client-supplied time blindly. */
export function intervalForStart(start: number, length: JobLength, cfg: ScheduleConfig): Interval | null {
  const date = DateTime.fromMillis(start, { zone: cfg.timezone }).toISODate()!;
  if (length.kind === "days") {
    const iv = multiDayInterval(date, Math.max(1, length.days), cfg);
    return iv && iv.start === start ? iv : null;
  }
  const w = openWindow(date, cfg);
  if (!w) return null;
  const dur = length.minutes * 60_000;
  const open = w.open.toMillis();
  const step = Math.max(5, cfg.slotIntervalMin) * 60_000;
  if (start < open || (start - open) % step !== 0) return null;
  if (start + dur > w.close.toMillis()) return null;
  return { start, end: start + dur };
}

/** Is `start` bookable right now for a customer (grid, hours, lead time, capacity)? */
export function isBookable(
  start: number,
  length: JobLength,
  busy: Interval[],
  cfg: ScheduleConfig,
  now: number,
): Interval | null {
  const iv = intervalForStart(start, length, cfg);
  if (!iv) return null;
  if (!withinBookingWindow(iv.start, cfg, now)) return null;
  return fits(busy, iv, cfg.bayCount) ? iv : null;
}

/** Local dates from today through the booking window. */
export function bookableDateRange(cfg: ScheduleConfig, now: number): string[] {
  const today = DateTime.fromMillis(now, { zone: cfg.timezone }).startOf("day");
  const out: string[] = [];
  for (let i = 0; i <= cfg.bookingWindowDays; i++) {
    out.push(today.plus({ days: i }).toISODate()!);
  }
  return out;
}
