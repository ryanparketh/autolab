import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { notifyReminder } from "@/lib/notify";
import { releaseExpiredHolds } from "@/lib/bookings";

export const dynamic = "force-dynamic";

const REMINDER_WINDOW_HOURS = 26;

function authorized(req: NextRequest): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const released = await releaseExpiredHolds();

  const now = new Date();
  const due = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      startAt: { gt: now, lt: new Date(now.getTime() + REMINDER_WINDOW_HOURS * 3_600_000) },
      // Don't remind someone who booked a couple of hours ago.
      createdAt: { lt: new Date(now.getTime() - 2 * 3_600_000) },
    },
    include: {
      customer: { select: { name: true, email: true, phone: true, smsOptIn: true } },
      vehicle: { select: { year: true, make: true, model: true } },
    },
  });

  let sent = 0;
  for (const b of due) {
    // Claim first so overlapping cron runs can't double-send.
    const { count } = await db.booking.updateMany({
      where: { id: b.id, reminderSentAt: null },
      data: { reminderSentAt: new Date() },
    });
    if (count === 1) {
      await notifyReminder(b);
      sent++;
    }
  }

  return NextResponse.json({ released, reminders: sent });
}
