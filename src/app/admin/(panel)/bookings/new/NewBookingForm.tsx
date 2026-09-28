"use client";

import { useState } from "react";
import { usePreservingAction } from "../../../ActionForm";
import { depositFor } from "@/lib/pricing";
import { VEHICLE_SIZES, vehicleSizeMeta, type VehicleSizeKey } from "@/config/site";
import { createBookingAction } from "../../../actions";

export type FormService = {
  id: string;
  name: string;
  category: string;
  durationDays: number | null;
  startingAtCents: number | null;
  depositType: "FLAT" | "PERCENT";
  depositValue: number;
  prices: Partial<Record<VehicleSizeKey, { priceCents: number; durationMinutes: number }>>;
};

type Prefill = {
  quoteId: string;
  serviceId: string;
  name: string;
  email: string;
  phone: string;
  smsOptIn: boolean;
  year: string;
  make: string;
  model: string;
  size: VehicleSizeKey;
};

const dollars = (c: number) => (c / 100).toFixed(2).replace(/\.00$/, "");

export function NewBookingForm({
  services,
  stripeReady,
  prefill,
}: {
  services: FormService[];
  stripeReady: boolean;
  prefill?: Prefill;
}) {
  const { state, pending, onSubmit } = usePreservingAction(createBookingAction);
  const [serviceId, setServiceId] = useState(prefill?.serviceId ?? "");
  const [size, setSize] = useState<VehicleSizeKey | "">(prefill?.size ?? "");
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [minutes, setMinutes] = useState("");
  const [paymentMode, setPaymentMode] = useState(stripeReady ? "link" : "none");

  const svc = services.find((s) => s.id === serviceId);

  // Suggest price/deposit/duration from the price list when service or size changes.
  function suggest(nextId: string, nextSize: VehicleSizeKey | "") {
    const s = services.find((x) => x.id === nextId);
    if (!s) return;
    const p = nextSize ? s.prices[nextSize] : undefined;
    const cents = p?.priceCents ?? s.startingAtCents ?? 0;
    setPrice(cents ? dollars(cents) : "");
    setDeposit(cents ? dollars(depositFor(cents, s)) : "");
    setMinutes(p?.durationMinutes ? String(p.durationMinutes) : "");
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl gap-6">
      {prefill && <input type="hidden" name="quoteId" value={prefill.quoteId} />}
      <fieldset disabled={pending} className="contents">
        <section className="card grid gap-4 p-5 sm:grid-cols-3">
          <h2 className="font-semibold sm:col-span-3">Customer</h2>
          <Field label="Name" name="name" defaultValue={prefill?.name} required />
          <Field label="Email" name="email" type="email" defaultValue={prefill?.email} required />
          <Field label="Phone" name="phone" type="tel" defaultValue={prefill?.phone} required />
          <label className="flex items-center gap-2 text-sm text-muted sm:col-span-3">
            <input type="checkbox" name="smsOptIn" defaultChecked={prefill?.smsOptIn} /> Customer agreed to SMS
          </label>
        </section>

        <section className="card grid gap-4 p-5 sm:grid-cols-5">
          <h2 className="font-semibold sm:col-span-5">Vehicle</h2>
          <Field label="Year" name="year" defaultValue={prefill?.year} required />
          <Field label="Make" name="make" defaultValue={prefill?.make} required />
          <Field label="Model" name="model" defaultValue={prefill?.model} required />
          <Field label="Color" name="color" />
          <div>
            <label className="label">Size</label>
            <select
              name="size"
              required
              className="input"
              value={size}
              onChange={(e) => {
                const v = e.target.value as VehicleSizeKey;
                setSize(v);
                suggest(serviceId, v);
              }}
            >
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
        </section>

        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Job</h2>
          <div className="sm:col-span-2">
            <label className="label">Service</label>
            <select
              name="serviceId"
              required
              className="input"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                suggest(e.target.value, size);
              }}
            >
              <option value="" disabled>
                Select…
              </option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <Field label="Date" name="date" type="date" required />
          <Field
            label={svc?.durationDays ? "Drop-off time" : "Start time"}
            name="time"
            type="time"
            required
            step={900}
          />
          {svc && !svc.durationDays && (
            <div>
              <label className="label">Duration (minutes)</label>
              <input
                name="durationMinutes"
                type="number"
                min={15}
                max={720}
                step={15}
                required
                className="input"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          )}
          {svc?.durationDays && (
            <p className="self-end text-sm text-muted">Occupies a bay for {svc.durationDays} business day(s).</p>
          )}
          <div>
            <label className="label">Price ($)</label>
            <input
              name="price"
              inputMode="decimal"
              required
              className="input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Deposit ($)</label>
            <input
              name="deposit"
              inputMode="decimal"
              className="input"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="label">Deposit collection</legend>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="radio"
                name="paymentMode"
                value="link"
                checked={paymentMode === "link"}
                disabled={!stripeReady}
                onChange={() => setPaymentMode("link")}
              />
              Email a Stripe payment link (slot held ~24h until paid){!stripeReady && " — Stripe not configured"}
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm text-muted">
              <input
                type="radio"
                name="paymentMode"
                value="none"
                checked={paymentMode === "none"}
                onChange={() => setPaymentMode("none")}
              />
              Confirm now (no deposit, or collected in person)
            </label>
          </fieldset>
          <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
            <input type="checkbox" name="force" /> Override capacity (book even if all bays are full)
          </label>
          <div className="sm:col-span-2">
            <label className="label">Internal notes</label>
            <textarea name="notes" rows={3} className="input" />
          </div>
        </section>

        {state?.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <div>
          <button className="btn btn-primary">{pending ? "Saving…" : "Create booking"}</button>
        </div>
      </fieldset>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  step?: number;
}) {
  return (
    <div>
      <label className="label" htmlFor={`f-${name}`}>
        {label}
      </label>
      <input
        id={`f-${name}`}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        step={step}
        className="input"
      />
    </div>
  );
}
