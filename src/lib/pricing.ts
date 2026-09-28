// Pure pricing logic. The server always recomputes prices from the database;
// nothing the browser sends about money is trusted.

export type DepositRule = { depositType: "FLAT" | "PERCENT"; depositValue: number };

export type Quote = {
  serviceCents: number;
  addOnCents: number;
  totalCents: number;
  depositCents: number;
  /** minutes of shop time for same-day jobs (service + add-ons) */
  minutes: number;
};

/** Stripe's minimum charge in USD is $0.50. */
export const MIN_DEPOSIT_CENTS = 50;

export function depositFor(totalCents: number, rule: DepositRule): number {
  const raw = rule.depositType === "PERCENT" ? Math.round((totalCents * rule.depositValue) / 100) : rule.depositValue;
  // Never collect more than the job costs; never ask for less than Stripe allows.
  const capped = Math.min(raw, totalCents);
  return capped < MIN_DEPOSIT_CENTS ? 0 : capped;
}

export function quote(
  base: { priceCents: number; durationMinutes: number },
  addOns: Array<{ priceCents: number; durationMinutes: number }>,
  rule: DepositRule,
): Quote {
  const addOnCents = addOns.reduce((s, a) => s + a.priceCents, 0);
  const totalCents = base.priceCents + addOnCents;
  return {
    serviceCents: base.priceCents,
    addOnCents,
    totalCents,
    depositCents: depositFor(totalCents, rule),
    minutes: base.durationMinutes + addOns.reduce((s, a) => s + a.durationMinutes, 0),
  };
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
