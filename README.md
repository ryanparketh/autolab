# Auto Lab

Website and booking system for Auto Lab: PPF, ceramic coating, window tint and detailing.

- **Public site**: services and prices by vehicle size, FAQ, contact, and policies.
- **Online booking** for detailing and tint:
  - live availability across bays, with multi-day jobs (paint correction, PPF, ceramic)
  - a Stripe deposit at checkout, with the slot held while the customer pays
- **Quote requests** for PPF and ceramic. The shop prices the job in admin, and the customer gets a Stripe payment link.
- **Admin (`/admin`)**:
  - bookings calendar
  - check-in / complete / no-show
  - reschedule, and cancel with a Stripe refund
  - manual bookings
  - customers and vehicle history
  - service, price and add-on editor
  - hours, bays and closed dates
- **Notifications**: email confirmations and reminders through Resend, and SMS through Twilio for customers who opt in.

Stack: Next.js 16 (App Router), TypeScript, Tailwind 4, Prisma 7, Postgres, Stripe Checkout, Resend and Twilio.

## Local development

```bash
cp .env.example .env              # fill in DATABASE_URL at minimum
npm install
npx prisma migrate dev            # create tables
npm run db:seed                   # placeholder services, prices, hours
npm run hash-password -- "your-dev-password"   # paste output into .env
npm run dev
```

In development without `STRIPE_SECRET_KEY`, bookings are confirmed straight away and flagged "deposit NOT collected". Emails and SMS are printed to the console. **In production, online booking refuses to run without Stripe.**

Checks: `npm test` (scheduling and pricing engine), `npm run typecheck`, `npm run lint`, `npm run build`.

## How scheduling works

- The shop has **N bays** (set in Admin → Hours & capacity). A booking takes one bay for `[startAt, endAt)`.
- **Same-day jobs** start on a slot grid (15, 30 or 60 minutes) and must finish by closing. Duration is the service's time for that vehicle size plus the add-on time.
- **Multi-day jobs** (where a service has "multi-day length" set) drop off at opening and occupy a bay until closing on their last business day. The car stays in the bay overnight, and closed days are skipped.
- A new job fits if fewer than N jobs overlap at **every instant** of its interval. This is a peak-concurrency sweep, not a simple overlap count.
- All booking writes take a Postgres advisory lock, so two customers can never grab the last bay at once. This is tested with parallel requests.
- `PENDING_PAYMENT` bookings hold their slot only until `holdExpiresAt`. The hold always outlives the Stripe Checkout session, so nobody can pay for a slot that was already released.

## Payments flow

1. The customer books, which creates a `PENDING_PAYMENT` booking and a Stripe Checkout session for the deposit only.
2. The Stripe webhook `checkout.session.completed` confirms the booking and sends the confirmation. The success page also reconciles, in case the webhook lags. Both paths are idempotent.
3. If the customer backs out of Checkout, the session is expired and the slot is freed immediately.
4. If a payment ever lands on a cancelled or expired booking, it is recorded and flagged ⚠ in admin, so money is never lost silently.

Refunds are issued from the booking page in admin.

## Deploying (Vercel + Neon)

1. Import the GitHub repo in Vercel (framework: Next.js; leave the build command on its default — it picks up `npm run vercel-build`, which runs migrations, seeds missing placeholder data, then builds. Re-running it never overwrites admin edits).
2. In the Vercel project → Storage, add a **Neon** Postgres database. It sets `DATABASE_URL` (pooled, used at runtime) and `DATABASE_URL_UNPOOLED` (direct, used for migrations) automatically.
3. Set the remaining variables from `.env.example` (at minimum `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH_B64`, `SESSION_SECRET`, `CRON_SECRET`, `SHOP_TIMEZONE`, and Stripe keys), then redeploy. `NEXT_PUBLIC_SITE_URL` is optional until you add a custom domain.
4. Stripe → Developers → Webhooks → add endpoint `https://<domain>/api/stripe/webhook` with events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`; put its signing secret in `STRIPE_WEBHOOK_SECRET`. Use test-mode keys (`sk_test_…`, card 4242 4242 4242 4242) until you're ready for real money.
5. Resend: verify the sending domain for `EMAIL_FROM`. Twilio: US numbers need **A2P 10DLC registration** before messages deliver — budget 1–3 weeks.
6. Cron: `vercel.json` runs reminders daily at 16:00 UTC (Vercel Hobby's max frequency). On Pro, change to hourly (`0 * * * *`).

## Before launch — placeholders to replace

- `src/config/site.ts`: phone, email, address, social links, certifications and cancellation policy.
- Admin → Services & prices: real packages, prices, durations and film/coating brands. The seed data says "brand TBD".
- Admin → Hours & capacity: real hours and bay count.
- The home page gallery: real before-and-after photos, in `public/` plus the gallery section of `src/app/(site)/page.tsx`.
- `src/components/Logo.tsx`: the real logo. Brand colors are the tokens at the top of `src/app/globals.css`.
- `src/app/(site)/policies/page.tsx`: have the owner confirm every term. This page is your evidence in deposit chargebacks.
