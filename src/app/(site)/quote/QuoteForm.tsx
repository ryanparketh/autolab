"use client";

import { useState } from "react";
import { VEHICLE_SIZES, categoryMeta, vehicleSizeMeta, type CategoryKey, type VehicleSizeKey } from "@/config/site";

type Svc = { id: string; name: string; category: CategoryKey; bookingMode: "INSTANT" | "QUOTE" };

export function QuoteForm({
  services,
  initialCategory,
  initialServiceId,
}: {
  services: Svc[];
  initialCategory?: string;
  initialServiceId?: string;
}) {
  const cats = Object.keys(categoryMeta) as CategoryKey[];
  const [category, setCategory] = useState<CategoryKey>(
    cats.includes(initialCategory as CategoryKey) ? (initialCategory as CategoryKey) : "PPF",
  );
  const [serviceId, setServiceId] = useState(services.some((s) => s.id === initialServiceId) ? initialServiceId! : "");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    smsOptIn: false,
    year: "",
    make: "",
    model: "",
    size: "" as VehicleSizeKey | "",
    message: "",
    website: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          serviceId: serviceId || undefined,
          contact: { name: form.name, email: form.email, phone: form.phone, smsOptIn: form.smsOptIn },
          vehicle: { year: form.year, make: form.make, model: form.model, size: form.size },
          message: form.message || undefined,
          website: form.website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Please check the form and try again.");
      setState("sent");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="card p-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ok/15 text-ok" aria-hidden>
          ✓
        </div>
        <h2 className="mt-6 text-2xl font-semibold">Request received.</h2>
        <p className="mt-3 text-muted">
          We&apos;ll email you within one business day. Check your inbox for a confirmation.
        </p>
      </div>
    );
  }

  const catServices = services.filter((s) => s.category === category);

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-6 sm:p-8">
      {error && (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="q-cat">
            Service type
          </label>
          <select
            id="q-cat"
            className="input"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as CategoryKey);
              setServiceId("");
            }}
          >
            {cats.map((c) => (
              <option key={c} value={c}>
                {categoryMeta[c].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="q-svc">
            Package <span className="text-subtle">(optional)</span>
          </label>
          <select id="q-svc" className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">Not sure — recommend one</option>
            {catServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="q-year">
            Year
          </label>
          <input
            id="q-year"
            required
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            className="input"
            value={form.year}
            onChange={set("year")}
          />
        </div>
        <div>
          <label className="label" htmlFor="q-make">
            Make
          </label>
          <input id="q-make" required maxLength={50} className="input" value={form.make} onChange={set("make")} />
        </div>
        <div>
          <label className="label" htmlFor="q-model">
            Model
          </label>
          <input id="q-model" required maxLength={80} className="input" value={form.model} onChange={set("model")} />
        </div>
        <div>
          <label className="label" htmlFor="q-size">
            Size
          </label>
          <select id="q-size" required className="input" value={form.size} onChange={set("size")}>
            <option value="" disabled>
              Select…
            </option>
            {VEHICLE_SIZES.map((s) => (
              <option key={s} value={s}>
                {vehicleSizeMeta[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="q-name">
            Name
          </label>
          <input
            id="q-name"
            required
            autoComplete="name"
            maxLength={100}
            className="input"
            value={form.name}
            onChange={set("name")}
          />
        </div>
        <div>
          <label className="label" htmlFor="q-email">
            Email
          </label>
          <input
            id="q-email"
            required
            type="email"
            autoComplete="email"
            maxLength={200}
            className="input"
            value={form.email}
            onChange={set("email")}
          />
        </div>
        <div>
          <label className="label" htmlFor="q-phone">
            Phone
          </label>
          <input
            id="q-phone"
            required
            type="tel"
            autoComplete="tel"
            maxLength={20}
            className="input"
            value={form.phone}
            onChange={set("phone")}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="q-msg">
          Details <span className="text-subtle">(optional)</span>
        </label>
        <textarea
          id="q-msg"
          rows={4}
          maxLength={2000}
          className="input"
          placeholder="Coverage you want, gloss or matte, paint condition, timing…"
          value={form.message}
          onChange={set("message")}
        />
      </div>

      <label className="flex items-start gap-3 text-sm text-muted">
        <input
          type="checkbox"
          className="mt-1 accent-[var(--color-accent)]"
          checked={form.smsOptIn}
          onChange={(e) => setForm({ ...form, smsOptIn: e.target.checked })}
        />
        <span>Text me about my quote and appointment. Msg &amp; data rates may apply. Reply STOP to opt out.</span>
      </label>

      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
        </label>
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Request my quote"}
      </button>
    </form>
  );
}
