import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/pricing";
import { ActionForm } from "../../../ActionForm";
import { customerAction } from "../../../actions";
import { PageTitle, StatusBadge, fmtLocal, sizeLabel } from "../../../ui";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  const c = await db.customer.findUnique({
    where: { id },
    include: {
      vehicles: { orderBy: { createdAt: "desc" } },
      bookings: { orderBy: { startAt: "desc" }, include: { vehicle: true } },
      quotes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!c) notFound();
  const tz = env.timezone;
  const lifetime = c.bookings.filter((b) => b.status === "COMPLETED").reduce((s, b) => s + b.priceCents, 0);
  const lastCoating = c.bookings.find((b) => b.status === "COMPLETED" && /ceramic|coating/i.test(b.serviceName));

  return (
    <>
      <Link href="/admin/customers" className="text-sm text-muted hover:text-ink">
        ← Customers
      </Link>
      <PageTitle title={c.name}>
        <Link href="/admin/bookings/new" className="btn btn-ghost !py-2">
          + New booking
        </Link>
      </PageTitle>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-4 font-semibold">Contact</h2>
            <ActionForm action={customerAction} className="space-y-3">
              <input type="hidden" name="id" value={c.id} />
              <input name="name" defaultValue={c.name} className="input" required aria-label="Name" />
              <input name="email" type="email" defaultValue={c.email} className="input" required aria-label="Email" />
              <input name="phone" defaultValue={c.phone} className="input" required aria-label="Phone" />
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" name="smsOptIn" defaultChecked={c.smsOptIn} /> SMS opt-in
              </label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={c.notes ?? ""}
                placeholder="Notes (preferences, paint issues, etc.)"
                className="input"
              />
              <button className="btn btn-ghost !py-2">Save</button>
            </ActionForm>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Vehicles</h2>
            <ul className="space-y-2 text-sm">
              {c.vehicles.map((v) => (
                <li key={v.id}>
                  {v.year} {v.make} {v.model}
                  <span className="text-muted">
                    {v.color ? ` · ${v.color}` : ""} · {sizeLabel[v.size]}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5 text-sm">
            <p>
              Lifetime spend: <span className="font-mono">{formatMoney(lifetime)}</span>
            </p>
            {lastCoating && (
              <p className="mt-2 text-muted">
                Coated {fmtLocal(lastCoating.startAt, tz, "LLL yyyy")} — due for a maintenance wash/inspection.
              </p>
            )}
          </section>
        </div>

        <section>
          <h2 className="mb-3 font-semibold">History</h2>
          <div className="card divide-y divide-line overflow-hidden">
            {c.bookings.length === 0 && <p className="p-4 text-muted">No bookings yet.</p>}
            {c.bookings.map((b) => (
              <Link
                key={b.id}
                href={`/admin/bookings/${b.id}`}
                className="flex items-center justify-between gap-3 p-4 hover:bg-surface-2"
              >
                <span>
                  <span className="block font-medium">{b.serviceName}</span>
                  <span className="block text-sm text-muted">
                    {fmtLocal(b.startAt, tz, "LLL d, yyyy")} · {b.vehicle.year} {b.vehicle.make} {b.vehicle.model}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-sm text-muted">{formatMoney(b.priceCents)}</span>
                  <StatusBadge status={b.status} />
                </span>
              </Link>
            ))}
          </div>
          {c.quotes.length > 0 && (
            <p className="mt-4 text-sm text-muted">
              {c.quotes.length} quote request(s).{" "}
              <Link href="/admin/quotes?all=1" className="text-accent hover:underline">
                View quotes
              </Link>
            </p>
          )}
        </section>
      </div>
    </>
  );
}
