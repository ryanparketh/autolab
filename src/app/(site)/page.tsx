import Link from "next/link";
import { connection } from "next/server";
import { getCatalog, fromPrice } from "@/lib/catalog";
import { formatMoney } from "@/lib/pricing";
import { categoryMeta, site, type CategoryKey } from "@/config/site";

const faqs = [
  {
    q: "How does the deposit work?",
    a: `A deposit secures your spot and is applied to your final invoice. The balance is due when you pick up your car. ${
      site.policies.depositRefundable
        ? `Cancel at least ${site.policies.cancellationNoticeHours} hours ahead for a full refund.`
        : ""
    }`,
  },
  {
    q: "Why do PPF and ceramic coating need a quote?",
    a: "Price depends on your vehicle, paint condition and coverage. We confirm the exact price after a quick look at your car — no surprises at pickup.",
  },
  {
    q: "How long will you have my car?",
    a: "Detailing and tint are usually same-day. PPF and ceramic coatings take 1–5 days, including cure time so the film or coating bonds properly.",
  },
  {
    q: "What's the difference between PPF and ceramic coating?",
    a: "PPF is a physical urethane film that absorbs rock chips and scratches. Ceramic coating is a hard, glossy layer that repels water and dirt and makes washing easier — it won't stop rock chips. Many owners put PPF on the front and ceramic over everything.",
  },
  {
    q: "Is window tint legal?",
    a: "Tint limits vary by state and window. We'll recommend shades that keep you legal where you're registered.",
  },
  {
    q: "Do I need to wash my car before my appointment?",
    a: "No. Every PPF, tint and coating job starts with our own decontamination wash and prep.",
  },
];

const steps = [
  { n: "01", t: "Choose your service", d: "Pick a package and your vehicle size. Prices are shown up front." },
  { n: "02", t: "Pick a time", d: "See real availability across our bays and book in under two minutes." },
  { n: "03", t: "Secure with a deposit", d: "Pay a small deposit online. The rest is due when you pick up." },
];

const pillars = [
  { t: "Film & coating specialists", d: "PPF, ceramic and tint are our core work, not an upsell." },
  { t: "Warranty-backed products", d: "Professional-grade films and coatings with manufacturer warranties." },
  { t: "Transparent pricing", d: "Detailing and tint prices published by vehicle size. No haggling." },
  { t: "Book any time", d: "Live availability and instant confirmation, day or night." },
];

export default async function HomePage() {
  await connection();
  const { services } = await getCatalog();
  const minByCategory = new Map<CategoryKey, number>();
  for (const s of services) {
    const p = fromPrice(s);
    if (p == null) continue;
    const cur = minByCategory.get(s.category);
    if (cur == null || p < cur) minByCategory.set(s.category, p);
  }
  const order: CategoryKey[] = ["PPF", "CERAMIC_COATING", "WINDOW_TINT", "DETAILING"];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
          aria-hidden
        />
        <div
          className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]"
          aria-hidden
        />
        <div className="container-x relative grid gap-12 py-20 sm:py-28 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow">PPF · Ceramic · Tint · Detailing</p>
            <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
              Engineered protection for the car you love.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">
              {site.name} installs paint protection film, ceramic coatings and window tint, and delivers detailing that
              makes it look new. See prices, check live availability and book in minutes.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/book" className="btn btn-primary">
                Book an appointment
              </Link>
              <Link href="/quote" className="btn btn-ghost">
                Get a PPF or ceramic quote
              </Link>
            </div>
          </div>
          <div className="card relative p-6 font-mono text-sm shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-line pb-4 text-xs text-subtle">
              <span>LAB REPORT · PROTECTION PACKAGE</span>
              <span className="flex items-center gap-1.5 text-ok">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" /> READY
              </span>
            </div>
            <dl className="divide-y divide-line">
              {[
                ["Paint protection film", "Full front", "Self-healing"],
                ["Ceramic coating", "Multi-layer", "Hydrophobic"],
                ["Window tint", "Ceramic IR", "UV rejection"],
                ["Detail", "Decon + polish", "Swirl-free"],
              ].map(([k, v, s]) => (
                <div key={k} className="flex items-center justify-between py-4">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right">
                    <span className="block text-ink">{v}</span>
                    <span className="text-xs text-accent">{s}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="container-x py-20" aria-labelledby="services-h">
        <p className="eyebrow">Services</p>
        <h2 id="services-h" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything your paint and glass need.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {order.map((k) => {
            const c = categoryMeta[k];
            const from = minByCategory.get(k);
            return (
              <Link
                key={k}
                href={`/services/${c.slug}`}
                className="card group relative overflow-hidden p-7 transition-colors hover:border-accent/60"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-xl font-semibold">{c.label}</h3>
                  {from != null && (
                    <span className="shrink-0 font-mono text-sm text-muted">from {formatMoney(from)}</span>
                  )}
                </div>
                <p className="mt-3 max-w-sm text-muted">{c.short}</p>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-accent">
                  Explore packages
                  <span className="transition-transform group-hover:translate-x-1" aria-hidden>
                    →
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Why */}
      <section className="border-y border-line bg-surface/40">
        <div className="container-x grid gap-10 py-20 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="eyebrow">Why {site.name}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Precision work. No guesswork.</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {pillars.map((p) => (
              <div key={p.t} className="border-l border-accent/50 pl-5">
                <h3 className="font-semibold">{p.t}</h3>
                <p className="mt-2 text-sm text-muted">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container-x py-20">
        <p className="eyebrow">How booking works</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="card p-7">
              <span className="font-mono text-sm text-accent">{s.n}</span>
              <h3 className="mt-4 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gallery — PLACEHOLDER until real before/after photos are supplied */}
      <section className="container-x pb-20" aria-labelledby="work-h">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Recent work</p>
            <h2 id="work-h" className="mt-3 text-3xl font-semibold tracking-tight">
              From the bay.
            </h2>
          </div>
          <a href={site.instagram} target="_blank" rel="noopener" className="text-sm text-accent hover:underline">
            More on Instagram →
          </a>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-line-strong bg-surface text-center text-xs text-subtle"
            >
              <span className="px-4">Photo placeholder — add your before/after shots</span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-line bg-surface/40">
        <div className="container-x grid gap-10 py-20 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Good questions.</h2>
            <p className="mt-4 text-muted">
              Something else? Call{" "}
              <a href={site.phoneHref} className="text-ink underline decoration-line-strong underline-offset-4">
                {site.phone}
              </a>
              .
            </p>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <span className="text-accent transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-x py-20">
        <div className="card relative overflow-hidden p-10 text-center sm:p-14">
          <div
            className="absolute inset-0 bg-gradient-to-br from-accent/20 via-transparent to-transparent"
            aria-hidden
          />
          <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">Ready when you are.</h2>
          <p className="relative mx-auto mt-4 max-w-md text-muted">
            Live availability, upfront pricing and instant confirmation.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/book" className="btn btn-primary">
              Book now
            </Link>
            <a href={site.phoneHref} className="btn btn-ghost">
              Call {site.phone}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
