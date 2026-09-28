import type { Metadata } from "next";
import { connection } from "next/server";
import { getCatalog } from "@/lib/catalog";
import { BookingWizard, type WizardAddOn, type WizardService } from "./BookingWizard";

export const metadata: Metadata = {
  title: "Book an appointment",
  description: "See live availability and book detailing or window tint online.",
};

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  await connection();
  const sp = await searchParams;
  const initial = typeof sp.service === "string" ? sp.service : undefined;
  const { services, addOns } = await getCatalog();

  const bookable: WizardService[] = services
    .filter((s) => s.bookingMode === "INSTANT" && s.prices.length > 0)
    .map((s) => ({
      id: s.id,
      slug: s.slug,
      category: s.category,
      name: s.name,
      tagline: s.tagline,
      durationDays: s.durationDays,
      popular: s.popular,
      depositType: s.depositType,
      depositValue: s.depositValue,
      prices: Object.fromEntries(
        s.prices.map((p) => [p.vehicleSize, { priceCents: p.priceCents, durationMinutes: p.durationMinutes }]),
      ),
    }));

  const wizardAddOns: WizardAddOn[] = addOns.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    priceCents: a.priceCents,
    categories: a.categories,
  }));

  return (
    <section className="container-x py-12 sm:py-16">
      <p className="eyebrow">Online booking</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Book your appointment</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Detailing and window tint can be booked instantly. For PPF and ceramic coatings,{" "}
        <a href="/quote" className="text-accent hover:underline">
          request a quote
        </a>{" "}
        — we&apos;ll confirm pricing and send you a booking link.
      </p>
      <div className="mt-10">
        <BookingWizard services={bookable} addOns={wizardAddOns} initialServiceSlug={initial} />
      </div>
    </section>
  );
}
