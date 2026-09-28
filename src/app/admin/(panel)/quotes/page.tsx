import Link from "next/link";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { categoryMeta } from "@/config/site";
import { ActionForm } from "../../ActionForm";
import { quoteStatusAction } from "../../actions";
import { PageTitle, StatusBadge, fmtLocal, sizeLabel } from "../../ui";

export const metadata = { title: "Quote requests" };

export default async function QuotesPage({ searchParams }: PageProps<"/admin/quotes">) {
  const showAll = (await searchParams).all === "1";
  const quotes = await db.quoteRequest.findMany({
    where: showAll ? {} : { status: { in: ["NEW", "CONTACTED"] } },
    include: { customer: true, service: true, booking: { select: { id: true, reference: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <>
      <PageTitle title="Quote requests">
        <Link href={showAll ? "/admin/quotes" : "/admin/quotes?all=1"} className="text-sm text-accent hover:underline">
          {showAll ? "Show open only" : "Show all"}
        </Link>
      </PageTitle>
      {quotes.length === 0 && <p className="text-muted">No open quote requests.</p>}
      <div className="space-y-4">
        {quotes.map((q) => (
          <article key={q.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  {categoryMeta[q.category].label}
                  {q.service && <span className="text-muted"> · {q.service.name}</span>}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {q.vehicleYear} {q.vehicleMake} {q.vehicleModel} · {sizeLabel[q.vehicleSize]}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-subtle">{fmtLocal(q.createdAt, env.timezone, "LLL d, h:mm a")}</span>
                <StatusBadge status={q.status} />
              </div>
            </div>
            <p className="mt-3 text-sm">
              <Link href={`/admin/customers/${q.customer.id}`} className="text-accent hover:underline">
                {q.customer.name}
              </Link>{" "}
              · <a href={`mailto:${q.customer.email}`}>{q.customer.email}</a> ·{" "}
              <a href={`tel:${q.customer.phone}`}>{q.customer.phone}</a>
            </p>
            {q.message && (
              <p className="mt-3 rounded-lg bg-bg/60 p-3 text-sm whitespace-pre-wrap text-muted">{q.message}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {q.booking ? (
                <Link href={`/admin/bookings/${q.booking.id}`} className="btn btn-ghost !py-2">
                  View booking {q.booking.reference}
                </Link>
              ) : (
                <>
                  <Link href={`/admin/bookings/new?quote=${q.id}`} className="btn btn-primary !py-2">
                    Price &amp; book
                  </Link>
                  {q.status === "NEW" && (
                    <ActionForm action={quoteStatusAction}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="status" value="CONTACTED" />
                      <button className="btn btn-ghost !py-2">Mark contacted</button>
                    </ActionForm>
                  )}
                  {q.status !== "CLOSED" && (
                    <ActionForm action={quoteStatusAction}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="status" value="CLOSED" />
                      <button className="btn btn-ghost !py-2">Close</button>
                    </ActionForm>
                  )}
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
