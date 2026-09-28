import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Contact & hours" };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function fmt(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

export default async function ContactPage() {
  await connection();
  const hours = await db.businessHours.findMany({ orderBy: { weekday: "asc" } });
  const a = site.address;
  return (
    <section className="container-x grid gap-10 py-16 sm:py-20 lg:grid-cols-2">
      <div>
        <p className="eyebrow">Contact</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Come see the lab.</h1>
        <div className="mt-8 space-y-6">
          <div>
            <h2 className="text-sm text-muted">Address</h2>
            <p className="mt-1 text-lg">
              {a.street}
              <br />
              {a.city}, {a.region} {a.postalCode}
            </p>
            <a
              href={site.mapsUrl}
              target="_blank"
              rel="noopener"
              className="mt-2 inline-block text-sm text-accent hover:underline"
            >
              Get directions →
            </a>
          </div>
          <div>
            <h2 className="text-sm text-muted">Phone</h2>
            <a href={site.phoneHref} className="mt-1 block text-lg hover:text-accent">
              {site.phone}
            </a>
          </div>
          <div>
            <h2 className="text-sm text-muted">Email</h2>
            <a href={`mailto:${site.email}`} className="mt-1 block text-lg hover:text-accent">
              {site.email}
            </a>
          </div>
          <div className="flex gap-3 pt-2">
            <Link href="/book" className="btn btn-primary">
              Book online
            </Link>
            <Link href="/quote" className="btn btn-ghost">
              Request a quote
            </Link>
          </div>
        </div>
      </div>
      <div className="card h-fit p-6 sm:p-8">
        <h2 className="font-semibold">Hours</h2>
        <table className="mt-4 w-full text-sm">
          <tbody className="divide-y divide-line">
            {DAYS.map((d, i) => {
              const h = hours.find((x) => x.weekday === i + 1);
              return (
                <tr key={d}>
                  <th scope="row" className="py-3 text-left font-normal text-muted">
                    {d}
                  </th>
                  <td className="py-3 text-right font-mono">
                    {h?.isOpen ? `${fmt(h.openMinute)} – ${fmt(h.closeMinute)}` : "Closed"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
