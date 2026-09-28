import Link from "next/link";
import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/pricing";
import { openWindow, peakOverlap } from "@/lib/availability";
import { loadScheduleConfig } from "@/lib/schedule";
import type { Prisma } from "@/generated/prisma/client";
import { PageTitle, StatusBadge, fmtLocal } from "../ui";

export const metadata = { title: "Bookings" };

const VIEWS = {
  upcoming: "Upcoming",
  pending: "Awaiting deposit",
  past: "Past",
  cancelled: "Cancelled / no-show",
} as const;
type View = keyof typeof VIEWS;

export default async function BookingsPage({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const view: View = (Object.keys(VIEWS) as View[]).includes(sp.view as View) ? (sp.view as View) : "upcoming";
  const tz = env.timezone;
  const todayStart = DateTime.now().setZone(tz).startOf("day");

  const where: Prisma.BookingWhereInput =
    view === "upcoming"
      ? { endAt: { gte: todayStart.toJSDate() }, status: { in: ["CONFIRMED", "IN_PROGRESS"] } }
      : view === "pending"
        ? { status: "PENDING_PAYMENT", holdExpiresAt: { gt: new Date() } }
        : view === "past"
          ? { endAt: { lt: todayStart.toJSDate() }, status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] } }
          : { status: { in: ["CANCELLED", "NO_SHOW"] } };

  const [bookings, cfg] = await Promise.all([
    db.booking.findMany({
      where,
      include: { customer: true, vehicle: true },
      orderBy: { startAt: view === "upcoming" || view === "pending" ? "asc" : "desc" },
      take: 200,
    }),
    loadScheduleConfig(),
  ]);

  // Group by local start date.
  const groups = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const key = DateTime.fromJSDate(b.startAt, { zone: tz }).toISODate()!;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }

  // Bay utilisation for upcoming days (uses all occupying bookings, incl. multi-day ones started earlier).
  const intervals = bookings.map((b) => ({ start: b.startAt.getTime(), end: b.endAt.getTime() }));

  return (
    <>
      <PageTitle title="Bookings">
        <Link href="/admin/bookings/new" className="btn btn-primary !py-2">
          + New booking
        </Link>
      </PageTitle>

      <div className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link
            key={v}
            href={`/admin?view=${v}`}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${v === view ? "border-accent bg-accent/10" : "border-line text-muted hover:text-ink"}`}
          >
            {VIEWS[v]}
          </Link>
        ))}
      </div>

      {bookings.length === 0 && <p className="text-muted">Nothing here.</p>}

      <div className="space-y-8">
        {[...groups.entries()].map(([date, list]) => {
          const w = view === "upcoming" ? openWindow(date, cfg) : null;
          const peak = w ? peakOverlap(intervals, { start: w.open.toMillis(), end: w.close.toMillis() }) : null;
          return (
            <section key={date}>
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <h2 className="font-semibold">
                  {DateTime.fromISO(date, { zone: tz }).hasSame(todayStart, "day")
                    ? "Today"
                    : DateTime.fromISO(date, { zone: tz }).toFormat("cccc, LLL d")}
                </h2>
                {peak != null && (
                  <span className={`font-mono text-xs ${peak >= cfg.bayCount ? "text-warn" : "text-subtle"}`}>
                    PEAK {peak}/{cfg.bayCount} BAYS
                  </span>
                )}
              </div>
              <div className="card divide-y divide-line overflow-hidden">
                {list.map((b) => (
                  <Link
                    key={b.id}
                    href={`/admin/bookings/${b.id}`}
                    className="grid gap-2 p-4 hover:bg-surface-2 sm:grid-cols-[120px_1fr_auto] sm:items-center"
                  >
                    <span className="font-mono text-sm">
                      {fmtLocal(b.startAt, tz, "h:mm a")}
                      {!DateTime.fromJSDate(b.startAt, { zone: tz }).hasSame(
                        DateTime.fromJSDate(b.endAt, { zone: tz }),
                        "day",
                      ) && <span className="block text-xs text-subtle">→ {fmtLocal(b.endAt, tz, "LLL d")}</span>}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{b.serviceName}</span>
                      <span className="block truncate text-sm text-muted">
                        {b.customer.name} · {b.vehicle.year} {b.vehicle.make} {b.vehicle.model}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 sm:justify-end">
                      <span className="font-mono text-sm text-muted">{formatMoney(b.priceCents)}</span>
                      <StatusBadge status={b.status} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
