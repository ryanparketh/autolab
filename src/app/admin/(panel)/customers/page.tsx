import Link from "next/link";
import { db } from "@/lib/db";
import { PageTitle } from "../../ui";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const q = String((await searchParams).q ?? "")
    .trim()
    .slice(0, 100);
  const customers = await db.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q.replace(/\D/g, "") || q } },
            {
              vehicles: {
                some: {
                  OR: [{ make: { contains: q, mode: "insensitive" } }, { model: { contains: q, mode: "insensitive" } }],
                },
              },
            },
          ],
        }
      : undefined,
    include: {
      vehicles: true,
      _count: { select: { bookings: { where: { status: "COMPLETED" } } } },
      bookings: { where: { status: "COMPLETED" }, select: { priceCents: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageTitle title="Customers" />
      <form className="mb-6 flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, email, phone or vehicle" className="input" />
        <button className="btn btn-ghost !py-2">Search</button>
      </form>
      <div className="card divide-y divide-line overflow-hidden">
        {customers.length === 0 && <p className="p-4 text-muted">No customers found.</p>}
        {customers.map((c) => (
          <Link
            key={c.id}
            href={`/admin/customers/${c.id}`}
            className="grid gap-1 p-4 hover:bg-surface-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center"
          >
            <span>
              <span className="block font-medium">{c.name}</span>
              <span className="block text-sm text-muted">{c.email}</span>
            </span>
            <span className="text-sm text-muted">
              {c.vehicles.map((v) => `${v.year} ${v.make} ${v.model}`).join(", ") || "—"}
            </span>
            <span className="font-mono text-xs text-subtle">
              {c._count.bookings} completed · $
              {Math.round(c.bookings.reduce((s, b) => s + b.priceCents, 0) / 100).toLocaleString()}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
