import { test } from "node:test";
import assert from "node:assert/strict";
import { depositFor, formatMoney, quote } from "../src/lib/pricing";

test("flat deposit", () => {
  assert.equal(depositFor(30000, { depositType: "FLAT", depositValue: 5000 }), 5000);
});

test("percent deposit rounds to cents", () => {
  assert.equal(depositFor(199999, { depositType: "PERCENT", depositValue: 20 }), 40000);
});

test("deposit never exceeds the total", () => {
  assert.equal(depositFor(3000, { depositType: "FLAT", depositValue: 5000 }), 3000);
});

test("deposit below Stripe minimum becomes zero (no online payment)", () => {
  assert.equal(depositFor(100, { depositType: "PERCENT", depositValue: 10 }), 0);
});

test("quote sums add-ons and time", () => {
  const q = quote(
    { priceCents: 25000, durationMinutes: 240 },
    [
      { priceCents: 4000, durationMinutes: 30 },
      { priceCents: 6000, durationMinutes: 60 },
    ],
    { depositType: "FLAT", depositValue: 5000 },
  );
  assert.deepEqual(q, {
    serviceCents: 25000,
    addOnCents: 10000,
    totalCents: 35000,
    depositCents: 5000,
    minutes: 330,
  });
});

test("formatMoney", () => {
  assert.equal(formatMoney(25000), "$250");
  assert.equal(formatMoney(12345), "$123.45");
});
