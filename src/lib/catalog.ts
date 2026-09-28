import "server-only";
import { db } from "./db";
import type { ServiceCategory } from "@/generated/prisma/client";

export async function getCatalog() {
  const [services, addOns] = await Promise.all([
    db.service.findMany({
      where: { active: true },
      include: { prices: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    db.addOn.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return { services, addOns };
}

export type Catalog = Awaited<ReturnType<typeof getCatalog>>;
export type CatalogService = Catalog["services"][number];

export async function getCategoryServices(category: ServiceCategory) {
  return db.service.findMany({
    where: { active: true, category },
    include: { prices: true },
    orderBy: { sortOrder: "asc" },
  });
}

/** Lowest price across sizes, for "from $X" labels. */
export function fromPrice(s: { startingAtCents: number | null; prices: { priceCents: number }[] }) {
  if (s.prices.length) return Math.min(...s.prices.map((p) => p.priceCents));
  return s.startingAtCents;
}
