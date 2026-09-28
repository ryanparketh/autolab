import type { Metadata } from "next";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { QuoteForm } from "./QuoteForm";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Request a quote",
  description: "Get an exact price for paint protection film or ceramic coating on your vehicle.",
};

export default async function QuotePage({ searchParams }: PageProps<"/quote">) {
  await connection();
  const sp = await searchParams;
  const services = await db.service.findMany({
    where: { active: true },
    select: { id: true, name: true, category: true, bookingMode: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return (
    <section className="container-x grid gap-12 py-12 sm:py-16 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <p className="eyebrow">Custom quote</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Get an exact price.</h1>
        <p className="mt-4 text-muted">
          PPF and ceramic coating prices depend on your vehicle, its paint condition and the coverage you want. Tell us
          about your car and we&apos;ll reply within one business day with a price and available dates.
        </p>
        <ol className="mt-8 space-y-4 text-sm">
          {[
            "Send us your vehicle and what you're after.",
            "We reply with an exact price and recommended package.",
            "You get a link to pick a date and pay a deposit.",
          ].map((t, i) => (
            <li key={t} className="flex gap-3">
              <span className="font-mono text-accent">0{i + 1}</span>
              <span className="text-muted">{t}</span>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-muted">
          Prefer to talk?{" "}
          <a href={site.phoneHref} className="text-ink underline decoration-line-strong underline-offset-4">
            {site.phone}
          </a>
        </p>
      </div>
      <QuoteForm
        services={services}
        initialCategory={typeof sp.category === "string" ? sp.category : undefined}
        initialServiceId={typeof sp.service === "string" ? sp.service : undefined}
      />
    </section>
  );
}
