import "server-only";
import Stripe from "stripe";
import { env } from "./env";

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(env.stripe.secretKey);
}

export function stripe(): Stripe {
  const key = env.stripe.secretKey;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(key);
  return client;
}

/** Stripe requires checkout sessions to live between 30 minutes and 24 hours. */
export const CHECKOUT_TTL_ONLINE_MIN = 30;
export const CHECKOUT_TTL_LINK_MIN = 23 * 60;
/** Our slot hold outlives the checkout session, so a customer can never pay for a
 * slot that has already been released to someone else. */
export const HOLD_GRACE_MIN = 5;

export async function createDepositCheckout(opts: {
  bookingId: string;
  reference: string;
  serviceName: string;
  depositCents: number;
  customerEmail: string;
  ttlMinutes: number;
}) {
  const expiresAt = Math.floor(Date.now() / 1000) + opts.ttlMinutes * 60;
  return stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: opts.customerEmail,
    client_reference_id: opts.bookingId,
    metadata: { bookingId: opts.bookingId, reference: opts.reference },
    payment_intent_data: {
      metadata: { bookingId: opts.bookingId, reference: opts.reference },
      description: `Auto Lab deposit ${opts.reference}`,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: opts.depositCents,
          product_data: {
            name: `Deposit — ${opts.serviceName}`,
            description: `Booking ${opts.reference}. Applied to your final invoice.`,
          },
        },
      },
    ],
    expires_at: expiresAt,
    success_url: `${env.siteUrl}/book/success?ref=${opts.reference}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.siteUrl}/book/cancelled?ref=${opts.reference}`,
  });
}
