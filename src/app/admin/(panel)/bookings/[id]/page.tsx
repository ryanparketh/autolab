import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/pricing";
import { ActionForm } from "../../../ActionForm";
import {
  bookingNotesAction,
  bookingStatusAction,
  cancelAction,
  markPaidAction,
  rescheduleAction,
} from "../../../actions";
import { PageTitle, StatusBadge, fmtLocal, sizeLabel } from "../../../ui";

export const metadata = { title: "Booking" };

export default async function BookingDetail({ params }: PageProps<"/admin/bookings/[id]">) {
  const { id } = await params;
  const b = await db.booking.findUnique({
    where: { id },
    include: { customer: true, vehicle: true, addOns: true, service: true, quote: true },
  });
  if (!b) notFound();
  const tz = env.timezone;
  const active = ["PENDING_PAYMENT", "CONFIRMED", "IN_PROGRESS"].includes(b.status);
  const balance = b.priceCents - (b.depositPaidAt && !b.depositRefundedAt ? b.depositCents : 0);
  const localStart = DateTime.fromJSDate(b.startAt, { zone: tz });

  return (
    <>
      <Link href="/admin" className="text-sm text-muted hover:text-ink">
        ← Bookings
      </Link>
      <PageTitle title={`${b.serviceName}`}>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-muted">{b.reference}</span>
          <StatusBadge status={b.status} />
        </div>
      </PageTitle>

      {b.adminNotes?.includes("⚠") && (
        <div className="mb-6 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          This booking has a warning in its notes — see below.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="card divide-y divide-line">
            {[
              [
                "When",
                `${fmtLocal(b.startAt, tz, "cccc LLL d, yyyy · h:mm a")} → ${fmtLocal(b.endAt, tz, "ccc LLL d · h:mm a")}`,
              ],
              ["Customer", null],
              [
                "Vehicle",
                `${b.vehicle.year} ${b.vehicle.make} ${b.vehicle.model}${b.vehicle.color ? ` · ${b.vehicle.color}` : ""} · ${sizeLabel[b.vehicleSize]}`,
              ],
              ["Source", b.source.toLowerCase() + (b.quote ? " (from quote)" : "")],
              ["Customer notes", b.customerNotes || "—"],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-1 p-4 sm:grid-cols-[150px_1fr]">
                <span className="text-sm text-muted">{k}</span>
                {k === "Customer" ? (
                  <span className="text-sm">
                    <Link href={`/admin/customers/${b.customer.id}`} className="text-accent hover:underline">
                      {b.customer.name}
                    </Link>
                    <span className="block text-muted">
                      <a href={`mailto:${b.customer.email}`} className="hover:text-ink">
                        {b.customer.email}
                      </a>{" "}
                      ·{" "}
                      <a href={`tel:${b.customer.phone}`} className="hover:text-ink">
                        {b.customer.phone}
                      </a>
                      {b.customer.smsOptIn && " · SMS ok"}
                    </span>
                  </span>
                ) : (
                  <span className="text-sm whitespace-pre-wrap">{v}</span>
                )}
              </div>
            ))}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Money</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{b.serviceName}</dt>
                <dd className="font-mono">
                  {formatMoney(b.priceCents - b.addOns.reduce((s, a) => s + a.priceCents, 0))}
                </dd>
              </div>
              {b.addOns.map((a) => (
                <div key={a.addOnId} className="flex justify-between">
                  <dt className="text-muted">+ {a.name}</dt>
                  <dd className="font-mono">{formatMoney(a.priceCents)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-2">
                <dt>Total</dt>
                <dd className="font-mono">{formatMoney(b.priceCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Deposit</dt>
                <dd className="font-mono">
                  {formatMoney(b.depositCents)}{" "}
                  {b.depositRefundedAt ? "(refunded)" : b.depositPaidAt ? "(paid)" : b.depositCents ? "(unpaid)" : ""}
                </dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Balance due at pickup</dt>
                <dd className="font-mono">{formatMoney(balance)}</dd>
              </div>
            </dl>
            {b.stripePaymentIntentId && (
              <a
                href={`https://dashboard.stripe.com/payments/${b.stripePaymentIntentId}`}
                target="_blank"
                rel="noopener"
                className="mt-3 inline-block text-xs text-accent hover:underline"
              >
                View in Stripe ↗
              </a>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Shop notes</h2>
            <ActionForm action={bookingNotesAction} className="space-y-3">
              <input type="hidden" name="id" value={b.id} />
              <textarea
                name="adminNotes"
                rows={4}
                className="input"
                defaultValue={b.adminNotes ?? ""}
                maxLength={5000}
              />
              <button className="btn btn-ghost !py-2">Save notes</button>
            </ActionForm>
          </section>
        </div>

        <div className="space-y-6">
          {b.status === "PENDING_PAYMENT" && (
            <section className="card p-5">
              <h2 className="font-semibold">Awaiting deposit</h2>
              <p className="mt-1 text-sm text-muted">
                Slot held until {b.holdExpiresAt ? fmtLocal(b.holdExpiresAt, tz, "LLL d h:mm a") : "—"}.
              </p>
              <ActionForm
                action={markPaidAction}
                className="mt-3"
                confirmText="Mark the deposit as collected in person?"
              >
                <input type="hidden" name="id" value={b.id} />
                <button className="btn btn-ghost !py-2">Mark deposit paid (cash / in person)</button>
              </ActionForm>
            </section>
          )}

          {(b.status === "CONFIRMED" || b.status === "IN_PROGRESS") && (
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Update status</h2>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["IN_PROGRESS", "Car checked in"],
                    ["COMPLETED", "Completed"],
                    ["NO_SHOW", "No-show"],
                  ] as const
                )
                  .filter(([s]) => s !== b.status)
                  .map(([s, label]) => (
                    <ActionForm key={s} action={bookingStatusAction}>
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="status" value={s} />
                      <button className={s === "NO_SHOW" ? "btn btn-danger !py-2" : "btn btn-ghost !py-2"}>
                        {label}
                      </button>
                    </ActionForm>
                  ))}
              </div>
            </section>
          )}

          {(b.status === "CONFIRMED" || b.status === "PENDING_PAYMENT") && (
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Reschedule</h2>
              <ActionForm action={rescheduleAction} className="space-y-3">
                <input type="hidden" name="id" value={b.id} />
                <input
                  type="datetime-local"
                  name="localStart"
                  required
                  step={900}
                  className="input"
                  defaultValue={localStart.toFormat("yyyy-LL-dd'T'HH:mm")}
                />
                {b.service.durationDays && (
                  <p className="text-xs text-subtle">
                    Multi-day job: it will run {b.service.durationDays} business day(s) from the new date.
                  </p>
                )}
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" name="force" /> Override capacity
                </label>
                <button className="btn btn-ghost !py-2">Reschedule &amp; notify customer</button>
              </ActionForm>
            </section>
          )}

          {active && (
            <section className="card border-danger/30 p-5">
              <h2 className="mb-3 font-semibold">Cancel booking</h2>
              <ActionForm
                action={cancelAction}
                className="space-y-3"
                confirmText="Cancel this booking? This can't be undone."
              >
                <input type="hidden" name="id" value={b.id} />
                {b.depositPaidAt && !b.depositRefundedAt && (
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      name="refund"
                      defaultChecked={!!b.stripePaymentIntentId}
                      disabled={!b.stripePaymentIntentId}
                    />{" "}
                    Refund {formatMoney(b.depositCents)} deposit
                    {!b.stripePaymentIntentId && " (paid offline — refund manually)"}
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" name="notify" defaultChecked /> Email the customer
                </label>
                <button className="btn btn-danger !py-2">Cancel booking</button>
              </ActionForm>
            </section>
          )}

          <p className="text-xs text-subtle">
            Created {fmtLocal(b.createdAt, tz, "LLL d, yyyy h:mm a")}
            {b.reminderSentAt && ` · Reminder sent ${fmtLocal(b.reminderSentAt, tz, "LLL d h:mm a")}`}
          </p>
        </div>
      </div>
    </>
  );
}
