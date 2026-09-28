import Link from "next/link";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/pricing";
import { categoryMeta, type CategoryKey } from "@/config/site";
import { ActionForm } from "../../ActionForm";
import { addOnAction } from "../../actions";
import { PageTitle } from "../../ui";

export const metadata = { title: "Services & prices" };

export default async function ServicesAdmin() {
  const [services, addOns] = await Promise.all([
    db.service.findMany({ include: { prices: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    db.addOn.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const cats = Object.keys(categoryMeta) as CategoryKey[];

  return (
    <>
      <PageTitle title="Services & prices">
        <Link href="/admin/services/new" className="btn btn-primary !py-2">
          + New service
        </Link>
      </PageTitle>

      <div className="space-y-8">
        {cats.map((cat) => (
          <section key={cat}>
            <h2 className="mb-2 font-semibold">{categoryMeta[cat].label}</h2>
            <div className="card divide-y divide-line overflow-hidden">
              {services
                .filter((s) => s.category === cat)
                .map((s) => {
                  const prices = s.prices.map((p) => p.priceCents);
                  return (
                    <Link
                      key={s.id}
                      href={`/admin/services/${s.id}`}
                      className="flex items-center justify-between gap-4 p-4 hover:bg-surface-2"
                    >
                      <span>
                        <span className={`font-medium ${s.active ? "" : "text-subtle line-through"}`}>{s.name}</span>
                        <span className="ml-2 text-xs text-subtle">
                          {s.bookingMode === "QUOTE" ? "quote" : "instant"} ·{" "}
                          {s.durationDays ? `${s.durationDays} day(s)` : "same-day"}
                        </span>
                      </span>
                      <span className="font-mono text-sm text-muted">
                        {prices.length
                          ? `${formatMoney(Math.min(...prices))}–${formatMoney(Math.max(...prices))}`
                          : s.startingAtCents
                            ? `from ${formatMoney(s.startingAtCents)}`
                            : "—"}
                      </span>
                    </Link>
                  );
                })}
            </div>
          </section>
        ))}
      </div>

      <h2 className="mt-12 mb-4 text-xl font-semibold">Add-ons</h2>
      <div className="space-y-3">
        {[...addOns, null].map((a) => (
          <ActionForm
            key={a?.id ?? `new-${addOns.length}`}
            action={addOnAction}
            className="card grid gap-3 p-4 lg:grid-cols-[1.2fr_2fr_100px_100px_auto]"
          >
            {a && <input type="hidden" name="id" value={a.id} />}
            <input
              name="name"
              defaultValue={a?.name}
              placeholder="New add-on name"
              className="input"
              required
              aria-label="Name"
            />
            <input
              name="description"
              defaultValue={a?.description}
              placeholder="Description"
              className="input"
              aria-label="Description"
            />
            <input
              name="price"
              defaultValue={a ? a.priceCents / 100 : ""}
              placeholder="Price $"
              className="input"
              required
              aria-label="Price"
            />
            <input
              name="durationMinutes"
              type="number"
              min={0}
              defaultValue={a?.durationMinutes ?? 0}
              className="input"
              aria-label="Extra minutes"
              title="Extra minutes"
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted lg:col-span-5">
              {cats.map((c) => (
                <label key={c} className="flex items-center gap-1.5">
                  <input type="checkbox" name="categories" value={c} defaultChecked={a?.categories.includes(c)} />
                  {categoryMeta[c].label}
                </label>
              ))}
              <label className="flex items-center gap-1.5">
                <input type="checkbox" name="active" defaultChecked={a?.active ?? true} /> Active
              </label>
              <input type="hidden" name="sortOrder" value={a?.sortOrder ?? addOns.length} />
              <button className="btn btn-ghost ml-auto !py-1.5">{a ? "Save" : "Add"}</button>
            </div>
          </ActionForm>
        ))}
      </div>
    </>
  );
}
