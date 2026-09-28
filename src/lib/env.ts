import "server-only";

// Centralised, validated access to server environment variables.
// Optional integrations (Stripe, Resend, Twilio) degrade gracefully in
// development but are required in production so a misconfigured deploy fails
// loudly instead of silently confirming unpaid bookings.

const isProd = process.env.NODE_ENV === "production";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  isProd,
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get timezone() {
    return process.env.SHOP_TIMEZONE || "America/Los_Angeles";
  },
  get siteUrl() {
    return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  },
  get sessionSecret() {
    const s = required("SESSION_SECRET");
    if (s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
    return s;
  },
  get adminEmail() {
    return required("ADMIN_EMAIL").toLowerCase();
  },
  /** bcrypt hashes contain `$`, which .env expansion mangles — so we store it base64-encoded. */
  get adminPasswordHash() {
    const b64 = process.env.ADMIN_PASSWORD_HASH_B64;
    return b64 ? Buffer.from(b64, "base64").toString("utf8") : null;
  },
  get cronSecret() {
    return process.env.CRON_SECRET || null;
  },
  stripe: {
    get secretKey() {
      return process.env.STRIPE_SECRET_KEY || null;
    },
    get webhookSecret() {
      return process.env.STRIPE_WEBHOOK_SECRET || null;
    },
  },
  email: {
    get resendKey() {
      return process.env.RESEND_API_KEY || null;
    },
    get from() {
      return process.env.EMAIL_FROM || "Auto Lab <bookings@autolab.example>";
    },
    get shopInbox() {
      return process.env.SHOP_NOTIFICATION_EMAIL || null;
    },
  },
  sms: {
    get sid() {
      return process.env.TWILIO_ACCOUNT_SID || null;
    },
    get token() {
      return process.env.TWILIO_AUTH_TOKEN || null;
    },
    get from() {
      return process.env.TWILIO_FROM_NUMBER || null;
    },
  },
};
