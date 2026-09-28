import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import {
  bookableDateRange,
  isBookable,
  multiDayInterval,
  peakOverlap,
  slotsForDate,
  type ScheduleConfig,
} from "../src/lib/availability";

const TZ = "America/Los_Angeles";

function cfg(over: Partial<ScheduleConfig> = {}): ScheduleConfig {
  const hours: ScheduleConfig["hours"] = {};
  for (let d = 1; d <= 7; d++) {
    hours[d] = { isOpen: d !== 7, openMinute: 8 * 60, closeMinute: 18 * 60 }; // closed Sundays
  }
  return {
    timezone: TZ,
    bayCount: 2,
    slotIntervalMin: 60,
    minLeadHours: 0,
    bookingWindowDays: 365,
    hours,
    closedDates: new Set(),
    ...over,
  };
}

const at = (iso: string) => DateTime.fromISO(iso, { zone: TZ }).toMillis();
// A Monday well in the past relative to nothing — we pass `now` explicitly.
const NOW = at("2026-03-01T00:00");

test("peakOverlap treats back-to-back jobs as non-overlapping", () => {
  const busy = [
    { start: 0, end: 10 },
    { start: 10, end: 20 },
  ];
  assert.equal(peakOverlap(busy, { start: 0, end: 20 }), 1);
});

test("peakOverlap finds true peak, not count of overlapping intervals", () => {
  // Three jobs touch the window but never more than two at once.
  const busy = [
    { start: 0, end: 5 },
    { start: 4, end: 8 },
    { start: 6, end: 10 },
  ];
  assert.equal(peakOverlap(busy, { start: 0, end: 10 }), 2);
});

test("same-day slots stop so the job finishes by close", () => {
  const slots = slotsForDate("2026-03-02", { kind: "minutes", minutes: 180 }, [], cfg(), NOW);
  const hours = slots.map((t) => DateTime.fromMillis(t, { zone: TZ }).hour);
  assert.deepEqual(hours, [8, 9, 10, 11, 12, 13, 14, 15]); // 15:00 + 3h = 18:00
});

test("closed weekday and closed date return no slots", () => {
  const c = cfg({ closedDates: new Set(["2026-03-03"]) });
  assert.deepEqual(slotsForDate("2026-03-08", { kind: "minutes", minutes: 60 }, [], c, NOW), []); // Sunday
  assert.deepEqual(slotsForDate("2026-03-03", { kind: "minutes", minutes: 60 }, [], c, NOW), []);
});

test("capacity: slot disappears only when every bay is taken", () => {
  const job = { start: at("2026-03-02T10:00"), end: at("2026-03-02T12:00") };
  const one = slotsForDate("2026-03-02", { kind: "minutes", minutes: 60 }, [job], cfg(), NOW);
  assert.ok(one.includes(at("2026-03-02T10:00")), "second bay still free");
  const two = slotsForDate("2026-03-02", { kind: "minutes", minutes: 60 }, [job, job], cfg(), NOW);
  assert.ok(!two.includes(at("2026-03-02T10:00")));
  assert.ok(!two.includes(at("2026-03-02T11:00")));
  assert.ok(two.includes(at("2026-03-02T12:00")), "free again after both jobs end");
});

test("multi-day job skips closed days and spans overnight", () => {
  // Saturday start, 2 days: Sat + (Sun closed) + Mon.
  const iv = multiDayInterval("2026-03-07", 2, cfg())!;
  assert.equal(iv.start, at("2026-03-07T08:00"));
  assert.equal(iv.end, at("2026-03-09T18:00"));
});

test("multi-day job is blocked by a same-day job overlapping any of its days", () => {
  const c = cfg({ bayCount: 1 });
  const busy = [{ start: at("2026-03-04T14:00"), end: at("2026-03-04T15:00") }];
  assert.deepEqual(slotsForDate("2026-03-03", { kind: "days", days: 2 }, busy, c, NOW), []);
  assert.equal(slotsForDate("2026-03-05", { kind: "days", days: 2 }, busy, c, NOW).length, 1);
});

test("multi-day occupancy blocks same-day slots on its days", () => {
  const c = cfg({ bayCount: 1 });
  const busy = [multiDayInterval("2026-03-02", 3, c)!];
  assert.deepEqual(slotsForDate("2026-03-03", { kind: "minutes", minutes: 60 }, busy, c, NOW), []);
  assert.ok(slotsForDate("2026-03-05", { kind: "minutes", minutes: 60 }, busy, c, NOW).length > 0);
});

test("minimum lead time hides slots that are too soon", () => {
  const now = at("2026-03-02T09:30");
  const slots = slotsForDate("2026-03-02", { kind: "minutes", minutes: 60 }, [], cfg({ minLeadHours: 2 }), now);
  assert.equal(DateTime.fromMillis(slots[0], { zone: TZ }).hour, 12); // 11:30 earliest -> 12:00 slot
});

test("booking window hides dates too far out", () => {
  const c = cfg({ bookingWindowDays: 7 });
  assert.equal(slotsForDate("2026-03-20", { kind: "minutes", minutes: 60 }, [], c, NOW).length, 0);
  assert.equal(bookableDateRange(c, NOW).length, 8);
});

test("isBookable rejects off-grid, after-hours and past starts", () => {
  const len = { kind: "minutes" as const, minutes: 60 };
  assert.ok(isBookable(at("2026-03-02T09:00"), len, [], cfg(), NOW));
  assert.equal(isBookable(at("2026-03-02T09:15"), len, [], cfg(), NOW), null);
  assert.equal(isBookable(at("2026-03-02T17:30"), len, [], cfg(), NOW), null);
  assert.equal(isBookable(at("2026-03-02T09:00"), len, [], cfg(), at("2026-03-03T00:00")), null);
});

test("isBookable for multi-day only accepts drop-off at opening", () => {
  const len = { kind: "days" as const, days: 2 };
  assert.ok(isBookable(at("2026-03-02T08:00"), len, [], cfg(), NOW));
  assert.equal(isBookable(at("2026-03-02T09:00"), len, [], cfg(), NOW), null);
});

test("DST spring-forward day keeps wall-clock opening hours", () => {
  // 2026-03-08 is DST start in the US; make Sunday open for this test.
  const c = cfg();
  c.hours[7] = { isOpen: true, openMinute: 8 * 60, closeMinute: 18 * 60 };
  const slots = slotsForDate("2026-03-08", { kind: "minutes", minutes: 60 }, [], c, NOW);
  const hours = slots.map((t) => DateTime.fromMillis(t, { zone: TZ }).hour);
  assert.equal(hours[0], 8);
  assert.equal(hours.at(-1), 17);
  assert.equal(slots.length, 10);
});

test("all-days-closed config doesn't loop forever", () => {
  const c = cfg();
  for (let d = 1; d <= 7; d++) c.hours[d].isOpen = false;
  assert.equal(multiDayInterval("2026-03-02", 3, c), null);
});
