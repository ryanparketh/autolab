import { NextResponse, type NextRequest } from "next/server";
import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { availabilityQuery } from "@/lib/validation";
import { bookableDateRange, intervalForStart, slotsForDate, type JobLength } from "@/lib/availability";
import { quote } from "@/lib/pricing";
import { loadBusy, loadScheduleConfig } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const parsed = availabilityQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { serviceId, size, addOns: addOnIds } = parsed.data;

  const service = await db.service.findFirst({
    where: { id: serviceId, active: true, bookingMode: "INSTANT" },
    include: { prices: { where: { vehicleSize: size } } },
  });
  const price = service?.prices[0];
  if (!service || !price) return NextResponse.json({ error: "Service not available" }, { status: 404 });

  const addOns = await db.addOn.findMany({
    where: { id: { in: addOnIds }, active: true, categories: { has: service.category } },
  });
  const q = quote(price, addOns, service);
  const length: JobLength = service.durationDays
    ? { kind: "days", days: service.durationDays }
    : { kind: "minutes", minutes: q.minutes };

  const cfg = await loadScheduleConfig();
  const now = Date.now();
  const dates = bookableDateRange(cfg, now);
  const from = DateTime.fromISO(dates[0], { zone: cfg.timezone }).toJSDate();
  // Multi-day jobs can extend past the window; pad generously.
  const to = DateTime.fromISO(dates.at(-1)!, { zone: cfg.timezone }).plus({ days: 30 }).toJSDate();
  const busy = await loadBusy(from, to);

  const days = dates
    .map((date) => ({
      date,
      slots: slotsForDate(date, length, busy, cfg, now).map((t) => {
        const iv = intervalForStart(t, length, cfg)!;
        return { start: new Date(iv.start).toISOString(), end: new Date(iv.end).toISOString() };
      }),
    }))
    .filter((d) => d.slots.length > 0);

  return NextResponse.json(
    {
      timezone: cfg.timezone,
      multiDay: length.kind === "days" ? length.days : null,
      quote: q,
      days,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
