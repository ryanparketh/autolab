"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { depositFor, formatMoney } from "@/lib/pricing";
import { VEHICLE_SIZES, categoryMeta, vehicleSizeMeta, type CategoryKey, type VehicleSizeKey } from "@/config/site";

export type WizardService = {
  id: string;
  slug: string;
  category: CategoryKey;
  name: string;
  tagline: string;
  durationDays: number | null;
  popular: boolean;
  depositType: "FLAT" | "PERCENT";
  depositValue: number;
  prices: Partial<Record<VehicleSizeKey, { priceCents: number; durationMinutes: number }>>;
};

export type WizardAddOn = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  categories: CategoryKey[];
};

type Slot = { start: string; end: string };
type Availability = { timezone: string; multiDay: number | null; days: { date: string; slots: Slot[] }[] };

const STEPS = ["Service", "Vehicle", "Date & time", "Your details", "Review"] as const;

export function BookingWizard({
  services,
  addOns,
  initialServiceSlug,
}: {
  services: WizardService[];
  addOns: WizardAddOn[];
  initialServiceSlug?: string;
}) {
  const initial = services.find((s) => s.slug === initialServiceSlug);
  const categories = useMemo(
    () => (Object.keys(categoryMeta) as CategoryKey[]).filter((c) => services.some((s) => s.category === c)),
    [services],
  );

  const [step, setStep] = useState(initial ? 1 : 0);
  const [category, setCategory] = useState<CategoryKey>(initial?.category ?? categories[0] ?? "DETAILING");
  const [serviceId, setServiceId] = useState<string | null>(initial?.id ?? null);
  const [size, setSize] = useState<VehicleSizeKey | null>(null);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [vehicle, setVehicle] = useState({ year: "", make: "", model: "", color: "" });
  const [slot, setSlot] = useState<Slot | null>(null);
  const [contact, setContact] = useState({ name: "", email: "", phone: "", smsOptIn: false });
  const [notes, setNotes] = useState("");
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const price = service && size ? service.prices[size] : undefined;
  const availableAddOns = service ? addOns.filter((a) => a.categories.includes(service.category)) : [];
  const chosenAddOns = availableAddOns.filter((a) => addOnIds.includes(a.id));
  const total = (price?.priceCents ?? 0) + chosenAddOns.reduce((s, a) => s + a.priceCents, 0);
  const deposit = service && price ? depositFor(total, service) : 0;

  // Availability depends on service, size and add-ons (add-ons add time).
  const [reloadKey, setReloadKey] = useState(0);
  const availKey = service && size ? `${service.id}|${size}|${[...addOnIds].sort().join(",")}|${reloadKey}` : null;
  const [fetched, setFetched] = useState<{ key: string; data?: Availability; error?: string } | null>(null);
  const current = fetched && fetched.key === availKey ? fetched : null;
  const avail = current?.data ?? null;
  const availError = current?.error ?? null;
  const loadingAvail = step === 2 && !!availKey && !current;

  useEffect(() => {
    if (step !== 2 || !availKey || !service || !size) return;
    if (fetched?.key === availKey) return;
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ serviceId: service.id, size, addOns: addOnIds.join(",") });
    fetch(`/api/availability?${qs}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "Couldn't load availability");
        return r.json() as Promise<Availability>;
      })
      .then((a) => {
        setFetched({ key: availKey, data: a });
        setSlot((cur) => (cur && a.days.some((d) => d.slots.some((s) => s.start === cur.start)) ? cur : null));
      })
      .catch((e) => {
        if (e.name !== "AbortError") setFetched({ key: availKey, error: e.message });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, availKey]);

  const topRef = useRef<HTMLDivElement>(null);
  function go(n: number) {
    setError(null);
    setStep(n);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const vehicleValid =
    size &&
    /^\d{4}$/.test(vehicle.year) &&
    +vehicle.year >= 1950 &&
    +vehicle.year <= new Date().getFullYear() + 2 &&
    vehicle.make.trim() &&
    vehicle.model.trim();
  const phoneDigits = contact.phone.replace(/\D/g, "");
  const contactValid =
    contact.name.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()) &&
    (phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits.startsWith("1")));

  async function submit() {
    if (!service || !size || !slot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          addOnIds,
          startAt: slot.start,
          contact,
          vehicle: { ...vehicle, size },
          notes: notes || undefined,
          acceptPolicy,
          website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          setSlot(null);
          setReloadKey((k) => k + 1);
          go(2);
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.assign(data.redirectUrl);
    } catch {
      setError("Network error. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  const tz = avail?.timezone;
  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
  const fmtDay = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz }).format(
      new Date(iso),
    );

  return (
    <div ref={topRef} className="grid scroll-mt-24 gap-8 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <ol className="mb-8 flex gap-2 overflow-x-auto pb-1 text-xs" aria-label="Booking progress">
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? "step" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 ${
                i === step
                  ? "border-accent bg-accent/10 text-ink"
                  : i < step
                    ? "border-line text-muted"
                    : "border-line text-subtle"
              }`}
            >
              <span className="font-mono">{i + 1}</span> {label}
            </li>
          ))}
        </ol>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        {/* Step 1 — service */}
        {step === 0 && (
          <div>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Category">
              {categories.map((c) => (
                <button
                  key={c}
                  role="tab"
                  aria-selected={category === c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    category === c ? "border-accent bg-accent/10" : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {categoryMeta[c].label}
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-3">
              {services
                .filter((s) => s.category === category)
                .map((s) => {
                  const min = Math.min(...Object.values(s.prices).map((p) => p!.priceCents));
                  const selected = s.id === serviceId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setServiceId(s.id);
                        setAddOnIds([]);
                        setSlot(null);
                        go(1);
                      }}
                      className={`card flex items-center justify-between gap-4 p-5 text-left transition-colors hover:border-accent/60 ${
                        selected ? "border-accent" : ""
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{s.name}</span>
                          {s.popular && (
                            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted">{s.tagline}</p>
                      </div>
                      <span className="shrink-0 font-mono text-sm text-muted">from {formatMoney(min)}</span>
                    </button>
                  );
                })}
            </div>
            <div className="mt-8 rounded-xl border border-dashed border-line-strong p-5 text-sm text-muted">
              Looking for <strong className="text-ink">PPF or ceramic coating</strong>? Those are priced per vehicle.{" "}
              <Link href="/quote" className="text-accent hover:underline">
                Request a quote →
              </Link>
            </div>
          </div>
        )}

        {/* Step 2 — vehicle + add-ons */}
        {step === 1 && service && (
          <div className="space-y-8">
            <fieldset>
              <legend className="label">Vehicle size</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {VEHICLE_SIZES.map((sz) => {
                  const p = service.prices[sz];
                  return (
                    <button
                      key={sz}
                      type="button"
                      disabled={!p}
                      aria-pressed={size === sz}
                      onClick={() => {
                        setSize(sz);
                        setSlot(null);
                      }}
                      className={`card p-4 text-left transition-colors disabled:opacity-40 ${
                        size === sz ? "border-accent bg-accent/5" : "hover:border-line-strong"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{vehicleSizeMeta[sz].label}</span>
                        <span className="font-mono text-sm">{p ? formatMoney(p.priceCents) : "—"}</span>
                      </div>
                      <p className="mt-1 text-xs text-subtle">e.g. {vehicleSizeMeta[sz].example}</p>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className="label" htmlFor="v-year">
                  Year
                </label>
                <input
                  id="v-year"
                  className="input"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="2024"
                  value={vehicle.year}
                  onChange={(e) => setVehicle({ ...vehicle, year: e.target.value.replace(/\D/g, "") })}
                />
              </div>
              <div>
                <label className="label" htmlFor="v-make">
                  Make
                </label>
                <input
                  id="v-make"
                  className="input"
                  placeholder="Tesla"
                  maxLength={50}
                  value={vehicle.make}
                  onChange={(e) => setVehicle({ ...vehicle, make: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="v-model">
                  Model
                </label>
                <input
                  id="v-model"
                  className="input"
                  placeholder="Model Y"
                  maxLength={80}
                  value={vehicle.model}
                  onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="v-color">
                  Color <span className="text-subtle">(optional)</span>
                </label>
                <input
                  id="v-color"
                  className="input"
                  placeholder="Black"
                  maxLength={40}
                  value={vehicle.color}
                  onChange={(e) => setVehicle({ ...vehicle, color: e.target.value })}
                />
              </div>
            </div>

            {availableAddOns.length > 0 && (
              <fieldset>
                <legend className="label">Add-ons</legend>
                <div className="grid gap-2">
                  {availableAddOns.map((a) => {
                    const on = addOnIds.includes(a.id);
                    return (
                      <label
                        key={a.id}
                        className={`card flex cursor-pointer items-start gap-3 p-4 ${on ? "border-accent/70" : ""}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 accent-[var(--color-accent)]"
                          checked={on}
                          onChange={() => {
                            setAddOnIds((ids) => (on ? ids.filter((i) => i !== a.id) : [...ids, a.id]));
                            setSlot(null);
                          }}
                        />
                        <span className="flex-1">
                          <span className="flex justify-between gap-3">
                            <span className="font-medium">{a.name}</span>
                            <span className="font-mono text-sm">+{formatMoney(a.priceCents)}</span>
                          </span>
                          <span className="mt-0.5 block text-sm text-muted">{a.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <Nav back={() => go(0)} next={() => go(2)} nextDisabled={!vehicleValid} />
          </div>
        )}

        {/* Step 3 — date & time */}
        {step === 2 && service && size && (
          <div>
            {loadingAvail && !avail && <p className="text-muted">Checking availability…</p>}
            {availError && (
              <p role="alert" className="text-danger">
                {availError}
              </p>
            )}
            {avail && avail.days.length === 0 && (
              <p className="text-muted">
                No online availability for this combination right now. Please call us — we can often fit you in.
              </p>
            )}
            {avail && avail.days.length > 0 && (
              <DateTimePicker avail={avail} slot={slot} onPick={setSlot} fmtTime={fmtTime} fmtDay={fmtDay} />
            )}
            <Nav back={() => go(1)} next={() => go(3)} nextDisabled={!slot} />
          </div>
        )}

        {/* Step 4 — contact */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="c-name">
                  Full name
                </label>
                <input
                  id="c-name"
                  className="input"
                  autoComplete="name"
                  maxLength={100}
                  value={contact.name}
                  onChange={(e) => setContact({ ...contact, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="c-email">
                  Email
                </label>
                <input
                  id="c-email"
                  type="email"
                  className="input"
                  autoComplete="email"
                  maxLength={200}
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="c-phone">
                  Mobile phone
                </label>
                <input
                  id="c-phone"
                  type="tel"
                  className="input"
                  autoComplete="tel"
                  placeholder="(555) 555-5555"
                  maxLength={20}
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-start gap-3 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-1 accent-[var(--color-accent)]"
                checked={contact.smsOptIn}
                onChange={(e) => setContact({ ...contact, smsOptIn: e.target.checked })}
              />
              <span>
                Text me appointment confirmations and reminders. Msg &amp; data rates may apply. Reply STOP to opt out.
              </span>
            </label>
            <div>
              <label className="label" htmlFor="c-notes">
                Anything we should know? <span className="text-subtle">(optional)</span>
              </label>
              <textarea
                id="c-notes"
                rows={3}
                className="input"
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {/* Honeypot — hidden from humans and screen readers */}
            <div aria-hidden className="absolute -left-[9999px]">
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>
            <Nav back={() => go(2)} next={() => go(4)} nextDisabled={!contactValid} />
          </div>
        )}

        {/* Step 5 — review */}
        {step === 4 && service && size && slot && (
          <div className="space-y-6">
            <div className="card divide-y divide-line">
              <Row k="Service" v={service.name} />
              <Row
                k="Vehicle"
                v={`${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicleSizeMeta[size].label}`}
              />
              <Row
                k={avail?.multiDay ? "Drop-off / pickup" : "When"}
                v={
                  avail?.multiDay
                    ? `${fmtDay(slot.start)} ${fmtTime(slot.start)} → ready ${fmtDay(slot.end)} by ${fmtTime(slot.end)}`
                    : `${fmtDay(slot.start)} at ${fmtTime(slot.start)}`
                }
              />
              <Row k="Contact" v={`${contact.name} · ${contact.email} · ${contact.phone}`} />
            </div>
            <label className="flex items-start gap-3 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-1 accent-[var(--color-accent)]"
                checked={acceptPolicy}
                onChange={(e) => setAcceptPolicy(e.target.checked)}
              />
              <span>
                I agree to the{" "}
                <Link href="/policies" target="_blank" className="text-accent hover:underline">
                  booking &amp; cancellation policy
                </Link>
                . My deposit is applied to the final invoice.
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-ghost" onClick={() => go(3)} disabled={submitting}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={submit} disabled={!acceptPolicy || submitting}>
                {submitting
                  ? "Securing your slot…"
                  : deposit > 0
                    ? `Pay ${formatMoney(deposit)} deposit & book`
                    : "Confirm booking"}
              </button>
            </div>
            {deposit > 0 && (
              <p className="text-xs text-subtle">
                You&apos;ll be taken to our secure payment page (Stripe). Your slot is held for 30 minutes while you
                pay.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-6">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Summary</h2>
          {!service ? (
            <p className="mt-4 text-sm text-subtle">Choose a service to get started.</p>
          ) : (
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{service.name}</dt>
                <dd className="font-mono">{price ? formatMoney(price.priceCents) : "—"}</dd>
              </div>
              {chosenAddOns.map((a) => (
                <div key={a.id} className="flex justify-between gap-3">
                  <dt className="text-muted">{a.name}</dt>
                  <dd className="font-mono">+{formatMoney(a.priceCents)}</dd>
                </div>
              ))}
              {slot && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Date</dt>
                  <dd>{fmtDay(slot.start)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3 border-t border-line pt-3 text-base">
                <dt>Estimated total</dt>
                <dd className="font-mono font-semibold">{price ? formatMoney(total) : "—"}</dd>
              </div>
              {price && deposit > 0 && (
                <div className="flex justify-between gap-3 text-accent">
                  <dt>Due today (deposit)</dt>
                  <dd className="font-mono">{formatMoney(deposit)}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid gap-1 p-4 sm:grid-cols-[140px_1fr]">
      <span className="text-sm text-muted">{k}</span>
      <span className="text-sm">{v}</span>
    </div>
  );
}

function Nav({ back, next, nextDisabled }: { back: () => void; next: () => void; nextDisabled: boolean }) {
  return (
    <div className="mt-8 flex gap-3">
      <button type="button" className="btn btn-ghost" onClick={back}>
        Back
      </button>
      <button type="button" className="btn btn-primary" onClick={next} disabled={nextDisabled}>
        Continue
      </button>
    </div>
  );
}

function DateTimePicker({
  avail,
  slot,
  onPick,
  fmtTime,
  fmtDay,
}: {
  avail: Availability;
  slot: Slot | null;
  onPick: (s: Slot) => void;
  fmtTime: (iso: string) => string;
  fmtDay: (iso: string) => string;
}) {
  const byDate = useMemo(() => new Map(avail.days.map((d) => [d.date, d.slots])), [avail]);
  const firstDate = avail.days[0].date;
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (slot) {
      const d = avail.days.find((d) => d.slots.some((s) => s.start === slot.start));
      if (d) return d.date;
    }
    return firstDate;
  });
  const [month, setMonth] = useState(selectedDate.slice(0, 7)); // "YYYY-MM"

  const months = useMemo(() => [...new Set(avail.days.map((d) => d.date.slice(0, 7)))], [avail]);
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first grid
  const cells: (string | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    first,
  );
  const mi = months.indexOf(month);
  const slots = byDate.get(selectedDate) ?? [];

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            className="h-9 w-9 rounded-lg border border-line disabled:opacity-30"
            onClick={() => setMonth(months[mi - 1])}
            disabled={mi <= 0}
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="font-medium">{monthLabel}</span>
          <button
            type="button"
            className="h-9 w-9 rounded-lg border border-line disabled:opacity-30"
            onClick={() => setMonth(months[mi + 1])}
            disabled={mi < 0 || mi >= months.length - 1}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-subtle">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <span key={`x${i}`} />;
            const has = byDate.has(date);
            const sel = date === selectedDate;
            return (
              <button
                key={date}
                type="button"
                disabled={!has}
                onClick={() => setSelectedDate(date)}
                aria-pressed={sel}
                aria-label={date}
                className={`aspect-square rounded-lg text-sm transition-colors ${
                  sel
                    ? "bg-accent font-semibold text-accent-ink"
                    : has
                      ? "bg-surface-2 hover:bg-accent/20"
                      : "text-subtle/50"
                }`}
              >
                {Number(date.slice(8))}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm text-muted">{slots[0] ? fmtDay(slots[0].start) : "Select a date"}</p>
        {avail.multiDay ? (
          slots[0] && (
            <button
              type="button"
              onClick={() => onPick(slots[0])}
              aria-pressed={slot?.start === slots[0].start}
              className={`card w-full p-5 text-left ${slot?.start === slots[0].start ? "border-accent bg-accent/5" : ""}`}
            >
              <span className="block font-medium">Drop off at {fmtTime(slots[0].start)}</span>
              <span className="mt-1 block text-sm text-muted">
                Ready {fmtDay(slots[0].end)} by {fmtTime(slots[0].end)}
              </span>
              <span className="mt-2 block text-xs text-subtle">
                This service takes {avail.multiDay} business day{avail.multiDay > 1 ? "s" : ""}.
              </span>
            </button>
          )
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => (
              <button
                key={s.start}
                type="button"
                onClick={() => onPick(s)}
                aria-pressed={slot?.start === s.start}
                className={`rounded-lg border px-2 py-2.5 text-sm transition-colors ${
                  slot?.start === s.start
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line hover:border-accent/60"
                }`}
              >
                {fmtTime(s.start)}
              </button>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-subtle">Times shown in shop local time.</p>
      </div>
    </div>
  );
}
