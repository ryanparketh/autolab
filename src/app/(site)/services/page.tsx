import type { Metadata } from "next";
import Link from "next/link";
import { categoryMeta } from "@/config/site";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <section className="container-x py-16 sm:py-20">
      <p className="eyebrow">Services</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">What we do</h1>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {Object.values(categoryMeta).map((c) => (
          <Link key={c.slug} href={`/services/${c.slug}`} className="card p-7 transition-colors hover:border-accent/60">
            <h2 className="text-xl font-semibold">{c.label}</h2>
            <p className="mt-2 text-muted">{c.short}</p>
            <span className="mt-5 inline-block text-sm text-accent">View packages →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
