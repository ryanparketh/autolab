import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { confirmFromCheckout } from "@/lib/bookings";
import { formatWhen } from "@/lib/notify";
import { formatMoney } from "@/lib/pricing";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Booking confirmed", robots: { index: false } };

export default async function SuccessPage({ searchParams }: PageProps<"/book/success">) {
  await connection();
  const sp = await searchParams;
  const ref = typeof sp.ref === "string" ? sp.ref : null;
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : null;

  // The webhook is the source of truth, but it can lag a few seconds behind the
  // redirect. Reconcile here too (idempotent) so the customer sees "confirmed".
  if (ref && sessionId && stripeConfigured()) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId);
      if (session.metadata?.reference === ref) await confirmFromCheckout(session);
    } catch (err) {
      console.error("[book/success] reconcile failed", err);
    }
  }

  // Only non-personal details are shown: the reference alone shouldn't reveal who booked.
  const booking = ref
    ? await db.booking.findUnique({
        where: { reference: ref },
        select: {
          reference: true,
          status: true,
          serviceName: true,
          startAt: true,
          endAt: true,
          depositCents: true,
          depositPaidAt: true,
        },
      })
    : null;

  const confirmed = booking && (booking.status === "CONFIRMED" || booking.status === "IN_PROGRESS");
  const pending = booking?.status === "PENDING_PAYMENT";

  return (
    <section className="container-x py-20">
      <div className="card mx-auto max-w-xl p-8 text-center sm:p-10">
        <div
          className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${confirmed ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"}`}
          aria-hidden
        >
          {confirmed ? "✓" : "…"}
        </div>
        <h1 className="mt-6 text-2xl font-semibold">
          {confirmed ? "You're booked." : pending ? "Payment processing…" : "Thanks!"}
        </h1>
        {booking ? (
          <>
            <p className="mt-3 text-muted">
              {confirmed
                ? "A confirmation is on its way to your inbox."
                : pending
                  ? "We're waiting for confirmation from our payment provider. Refresh in a moment — you'll also get an email once it's confirmed."
                  : `This booking is ${booking.status.toLowerCase().replace("_", " ")}. Call us at ${site.phone} if that's unexpected.`}
            </p>
            <dl className="mt-8 space-y-3 rounded-xl border border-line bg-bg/60 p-5 text-left text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Reference</dt>
                <dd className="font-mono">{booking.reference}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Service</dt>
                <dd className="text-right">{booking.serviceName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">When</dt>
                <dd className="text-right">{formatWhen(booking.startAt, booking.endAt)}</dd>
              </div>
              {booking.depositPaidAt && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Deposit paid</dt>
                  <dd className="font-mono">{formatMoney(booking.depositCents)}</dd>
                </div>
              )}
            </dl>
          </>
        ) : (
          <p className="mt-3 text-muted">Your request was received.</p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-ghost">
            Back to home
          </Link>
          <a href={site.phoneHref} className="btn btn-ghost">
            Questions? Call us
          </a>
        </div>
      </div>
    </section>
  );
}
