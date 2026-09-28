import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getCategoryServices } from "@/lib/catalog";
import { formatMoney } from "@/lib/pricing";
import { VEHICLE_SIZES, categoryBySlug, categoryMeta, vehicleSizeMeta } from "@/config/site";

type Props = PageProps<"/services/[category]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const key = categoryBySlug[(await params).category];
  if (!key) return {};
  return { title: categoryMeta[key].label, description: categoryMeta[key].short };
}

function durationLabel(days: number | null, minutes: number[]) {
  if (days) return days === 1 ? "1 day" : `${days} days incl. cure time`;
  if (!minutes.length) return null;
  const lo = Math.min(...minutes) / 60;
  const hi = Math.max(...minutes) / 60;
  const f = (h: number) => (Number.isInteger(h) ? `${h}` : h.toFixed(1));
  return lo === hi ? `~${f(lo)} hrs` : `${f(lo)}–${f(hi)} hrs`;
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const key = categoryBySlug[category];
  if (!key) notFound();
  await connection();
  const meta = categoryMeta[key];
  const services = await getCategoryServices(key);

  return (
    <>
      <section className="border-b border-line">
        <div className="container-x py-16 sm:py-20">
          <Link href="/services" className="text-sm text-muted hover:text-ink">
            ← All services
          </Link>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{meta.label}</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">{meta.short}</p>
        </div>
      </section>

      <section className="container-x space-y-6 py-14">
        {services.length === 0 && <p className="text-muted">Packages coming soon. Call us for pricing.</p>}
        {services.map((s) => {
          const priceBySize = new Map(s.prices.map((p) => [p.vehicleSize, p]));
          const duration = durationLabel(
            s.durationDays,
            s.prices.map((p) => p.durationMinutes),
          );
          const isQuote = s.bookingMode === "QUOTE";
          return (
            <article key={s.id} id={s.slug} className="card scroll-mt-24 p-6 sm:p-8">
              <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold">{s.name}</h2>
                    {s.popular && (
                      <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                        Most popular
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-muted">{s.description}</p>
                  <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                    {s.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-accent" aria-hidden>
                          ✓
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {duration && (
                    <p className="mt-5 font-mono text-xs text-subtle">TIME IN SHOP · {duration.toUpperCase()}</p>
                  )}
                </div>

                <div className="flex flex-col justify-between gap-6 rounded-xl border border-line bg-bg/60 p-5">
                  {isQuote ? (
                    <div>
                      <p className="text-sm text-muted">Starting at</p>
                      <p className="mt-1 text-3xl font-semibold">
                        {s.startingAtCents != null ? formatMoney(s.startingAtCents) : "Custom"}
                      </p>
                      <p className="mt-2 text-sm text-muted">
                        Final price depends on your vehicle and paint condition. Quotes within one business day.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <caption className="sr-only">Price by vehicle size</caption>
                      <tbody className="divide-y divide-line">
                        {VEHICLE_SIZES.map((size) => {
                          const p = priceBySize.get(size);
                          return (
                            <tr key={size}>
                              <th scope="row" className="py-2.5 text-left font-normal text-muted">
                                {vehicleSizeMeta[size].label}
                              </th>
                              <td className="py-2.5 text-right font-mono">{p ? formatMoney(p.priceCents) : "Call"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  <Link
                    href={isQuote ? `/quote?category=${s.category}&service=${s.id}` : `/book?service=${s.slug}`}
                    className="btn btn-primary w-full"
                  >
                    {isQuote ? "Request a quote" : "Book this service"}
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
