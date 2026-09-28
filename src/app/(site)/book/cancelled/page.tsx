import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { abandonCheckout } from "@/lib/bookings";
import { stripeConfigured } from "@/lib/stripe";

export const metadata: Metadata = { title: "Payment cancelled", robots: { index: false } };

export default async function CancelledPage({ searchParams }: PageProps<"/book/cancelled">) {
  await connection();
  const ref = (await searchParams).ref;
  // Free the held slot immediately instead of waiting for the 30-minute hold to lapse.
  if (typeof ref === "string" && stripeConfigured()) await abandonCheckout(ref);

  return (
    <section className="container-x py-20">
      <div className="card mx-auto max-w-xl p-8 text-center sm:p-10">
        <h1 className="text-2xl font-semibold">Payment cancelled</h1>
        <p className="mt-3 text-muted">
          No charge was made and your slot has been released. You can start again any time.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/book" className="btn btn-primary">
            Try again
          </Link>
          <Link href="/" className="btn btn-ghost">
            Home
          </Link>
        </div>
      </div>
    </section>
  );
}
