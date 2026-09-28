import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { confirmFromCheckout, expireFromCheckout } from "@/lib/bookings";

// Configure in Stripe Dashboard → Developers → Webhooks with events:
//   checkout.session.completed, checkout.session.async_payment_succeeded,
//   checkout.session.expired
export async function POST(req: NextRequest) {
  const secret = env.stripe.webhookSecret;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    // Signature is computed over the raw body, so read it as text.
    event = stripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await confirmFromCheckout(event.data.object);
        break;
      case "checkout.session.expired":
        await expireFromCheckout(event.data.object.id);
        break;
    }
  } catch (err) {
    // Non-2xx makes Stripe retry with backoff, which is what we want on DB errors.
    console.error("[stripe webhook]", event.type, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
