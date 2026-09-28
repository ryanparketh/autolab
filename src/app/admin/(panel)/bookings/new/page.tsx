import Link from "next/link";
import { db } from "@/lib/db";
import { stripeConfigured } from "@/lib/stripe";
import { PageTitle } from "../../../ui";
import { NewBookingForm, type FormService } from "./NewBookingForm";

export const metadata = { title: "New booking" };

export default async function NewBookingPage({ searchParams }: PageProps<"/admin/bookings/new">) {
  const sp = await searchParams;
  const quoteId = typeof sp.quote === "string" ? sp.quote : undefined;
  const [services, quote] = await Promise.all([
    db.service.findMany({ include: { prices: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    quoteId ? db.quoteRequest.findUnique({ where: { id: quoteId }, include: { customer: true } }) : null,
  ]);

  const formServices: FormService[] = services.map((s) => ({
    id: s.id,
    name: `${s.name}${s.active ? "" : " (inactive)"}`,
    category: s.category,
    durationDays: s.durationDays,
    startingAtCents: s.startingAtCents,
    depositType: s.depositType,
    depositValue: s.depositValue,
    prices: Object.fromEntries(
      s.prices.map((p) => [p.vehicleSize, { priceCents: p.priceCents, durationMinutes: p.durationMinutes }]),
    ),
  }));

  return (
    <>
      <Link href={quote ? "/admin/quotes" : "/admin"} className="text-sm text-muted hover:text-ink">
        ← Back
      </Link>
      <PageTitle title={quote ? "Convert quote to booking" : "New booking"} />
      {quote?.message && (
        <div className="card mb-6 max-w-3xl p-4 text-sm">
          <p className="text-muted">Customer message</p>
          <p className="mt-1 whitespace-pre-wrap">{quote.message}</p>
        </div>
      )}
      <NewBookingForm
        services={formServices}
        stripeReady={stripeConfigured()}
        prefill={
          quote
            ? {
                quoteId: quote.id,
                serviceId: quote.serviceId ?? "",
                name: quote.customer.name,
                email: quote.customer.email,
                phone: quote.customer.phone,
                smsOptIn: quote.customer.smsOptIn,
                year: String(quote.vehicleYear),
                make: quote.vehicleMake,
                model: quote.vehicleModel,
                size: quote.vehicleSize,
              }
            : undefined
        }
      />
    </>
  );
}
