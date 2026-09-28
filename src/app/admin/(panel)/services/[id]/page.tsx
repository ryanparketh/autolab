import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { VEHICLE_SIZES, categoryMeta, vehicleSizeMeta, type CategoryKey } from "@/config/site";
import { ActionForm } from "../../../ActionForm";
import { serviceAction } from "../../../actions";
import { PageTitle } from "../../../ui";

export const metadata = { title: "Edit service" };

export default async function ServiceEdit({ params }: PageProps<"/admin/services/[id]">) {
  const { id } = await params;
  const isNew = id === "new";
  const s = isNew ? null : await db.service.findUnique({ where: { id }, include: { prices: true } });
  if (!isNew && !s) notFound();
  const price = new Map(s?.prices.map((p) => [p.vehicleSize, p]) ?? []);

  return (
    <>
      <Link href="/admin/services" className="text-sm text-muted hover:text-ink">
        ← Services
      </Link>
      <PageTitle title={isNew ? "New service" : s!.name} />
      <ActionForm action={serviceAction} className="grid max-w-3xl gap-6">
        {s && <input type="hidden" name="id" value={s.id} />}
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input name="name" required defaultValue={s?.name} className="input" />
          </div>
          <div>
            <label className="label">URL slug</label>
            <input name="slug" required pattern="[a-z0-9\-]+" defaultValue={s?.slug} className="input" />
          </div>
          <div>
            <label className="label">Category</label>
            <select name="category" defaultValue={s?.category ?? "DETAILING"} className="input">
              {(Object.keys(categoryMeta) as CategoryKey[]).map((c) => (
                <option key={c} value={c}>
                  {categoryMeta[c].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Booking mode</label>
            <select name="bookingMode" defaultValue={s?.bookingMode ?? "INSTANT"} className="input">
              <option value="INSTANT">Instant — customers book &amp; pay online</option>
              <option value="QUOTE">Quote — show &ldquo;starting at&rdquo;, request quote</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Tagline</label>
            <input name="tagline" defaultValue={s?.tagline} maxLength={200} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <textarea name="description" rows={3} defaultValue={s?.description} maxLength={2000} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">What&apos;s included (one per line)</label>
            <textarea name="features" rows={5} defaultValue={s?.features.join("\n")} className="input" />
          </div>
        </section>

        <section className="card grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <label className="label">Multi-day length (days)</label>
            <input
              name="durationDays"
              type="number"
              min={1}
              max={30}
              defaultValue={s?.durationDays ?? ""}
              placeholder="blank = same-day"
              className="input"
            />
          </div>
          <div>
            <label className="label">&ldquo;Starting at&rdquo; ($)</label>
            <input
              name="startingAt"
              defaultValue={s?.startingAtCents != null ? s.startingAtCents / 100 : ""}
              className="input"
            />
          </div>
          <div>
            <label className="label">Sort order</label>
            <input name="sortOrder" type="number" defaultValue={s?.sortOrder ?? 0} className="input" />
          </div>
          <div>
            <label className="label">Deposit type</label>
            <select name="depositType" defaultValue={s?.depositType ?? "FLAT"} className="input">
              <option value="FLAT">Flat amount ($)</option>
              <option value="PERCENT">Percent of total (%)</option>
            </select>
          </div>
          <div>
            <label className="label">Deposit value</label>
            <input
              name="depositValue"
              required
              defaultValue={s ? (s.depositType === "FLAT" ? s.depositValue / 100 : s.depositValue) : 50}
              className="input"
            />
          </div>
          <div className="flex flex-col justify-end gap-2 text-sm text-muted">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="active" defaultChecked={s?.active ?? true} /> Active (visible on site)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="popular" defaultChecked={s?.popular} /> &ldquo;Most popular&rdquo; badge
            </label>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Prices by vehicle size</h2>
          <p className="mt-1 text-sm text-muted">
            Required for instant booking. Leave a size blank to hide it. Minutes are shop time for same-day jobs
            (ignored for multi-day).
          </p>
          <div className="mt-4 grid gap-3">
            {VEHICLE_SIZES.map((sz) => (
              <div key={sz} className="grid grid-cols-[1fr_110px_110px] items-center gap-3">
                <span className="text-sm">{vehicleSizeMeta[sz].label}</span>
                <input
                  name={`price_${sz}`}
                  placeholder="$"
                  defaultValue={price.get(sz) ? price.get(sz)!.priceCents / 100 : ""}
                  className="input"
                  aria-label={`${sz} price`}
                />
                <input
                  name={`mins_${sz}`}
                  type="number"
                  min={15}
                  max={720}
                  step={15}
                  placeholder="min"
                  defaultValue={price.get(sz)?.durationMinutes || ""}
                  className="input"
                  aria-label={`${sz} minutes`}
                />
              </div>
            ))}
          </div>
        </section>

        <div>
          <button className="btn btn-primary">Save service</button>
        </div>
      </ActionForm>
    </>
  );
}
