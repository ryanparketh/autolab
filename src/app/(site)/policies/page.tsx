import type { Metadata } from "next";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Booking & privacy policy" };

// PLACEHOLDER policy text. Have the owner confirm every term — this page is what
// you point to when a customer disputes a deposit with their bank.
export default function PoliciesPage() {
  const h = site.policies.cancellationNoticeHours;
  return (
    <section className="container-x max-w-3xl py-16 sm:py-20">
      <h1 className="text-4xl font-semibold tracking-tight">Booking &amp; privacy policy</h1>
      <div className="mt-10 space-y-10 leading-relaxed text-muted [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink">
        <div>
          <h2>Deposits</h2>
          <p>
            A deposit is required to reserve most appointments. It is applied in full to your final invoice. The
            remaining balance is due at pickup. Prices shown online are estimates based on vehicle size; if your vehicle
            needs significantly more work than expected (for example heavy contamination or pet hair), we will contact
            you before starting any additional work.
          </p>
        </div>
        <div>
          <h2>Cancellations &amp; rescheduling</h2>
          <p>
            You can cancel or reschedule free of charge up to {h} hours before your appointment by calling {site.phone}{" "}
            or emailing {site.email}.{" "}
            {site.policies.depositRefundable
              ? `Deposits for cancellations made at least ${h} hours in advance are refunded in full. Cancellations with less than ${h} hours' notice, and missed appointments, forfeit the deposit.`
              : "Deposits are non-refundable but can be applied to a rescheduled appointment."}
          </p>
        </div>
        <div>
          <h2>Multi-day services</h2>
          <p>
            Paint protection film, ceramic coatings and paint correction may require your vehicle to stay with us
            overnight so films and coatings can cure properly. We&apos;ll confirm your pickup time when you drop off.
          </p>
        </div>
        <div>
          <h2>Text messages</h2>
          <p>
            If you opt in, we&apos;ll send appointment confirmations and reminders by SMS. Message frequency varies.
            Message and data rates may apply. Reply STOP to opt out or HELP for help. We never sell your number or use
            it for marketing without separate consent.
          </p>
        </div>
        <div>
          <h2>Privacy</h2>
          <p>
            We collect your name, contact details and vehicle information to schedule and perform your service. Card
            payments are processed by Stripe; we never see or store your full card number. We don&apos;t sell your
            personal information. To access or delete your data, email {site.email}.
          </p>
        </div>
      </div>
    </section>
  );
}
