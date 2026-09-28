import "server-only";
import { DateTime } from "luxon";
import { Resend } from "resend";
import twilio from "twilio";
import { env } from "./env";
import { formatMoney } from "./pricing";
import { site } from "@/config/site";
import { toE164 } from "./validation";

// Notifications never throw: a failed email must not roll back a paid booking.
// Failures are logged so they show up in the hosting provider's logs.

type BookingForNotice = {
  reference: string;
  serviceName: string;
  startAt: Date;
  endAt: Date;
  priceCents: number;
  depositCents: number;
  depositPaidAt: Date | null;
  customer: { name: string; email: string; phone: string; smsOptIn: boolean };
  vehicle: { year: number; make: string; model: string };
};

export function formatWhen(start: Date, end: Date): string {
  const s = DateTime.fromJSDate(start, { zone: env.timezone });
  const e = DateTime.fromJSDate(end, { zone: env.timezone });
  if (s.hasSame(e, "day")) {
    return `${s.toFormat("cccc, LLL d 'at' h:mm a")} (about ${Math.round(e.diff(s, "hours").hours * 10) / 10} hrs)`;
  }
  return `Drop-off ${s.toFormat("cccc, LLL d 'at' h:mm a")} · Ready ${e.toFormat("cccc, LLL d 'by' h:mm a")}`;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string) {
  const addr = site.address;
  return `<!doctype html><html><body style="margin:0;background:#0b0d10;font-family:Helvetica,Arial,sans-serif;color:#e8eaed">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#14171c;border-radius:12px;border:1px solid #262a31">
<tr><td style="padding:28px 32px;border-bottom:1px solid #262a31;font-size:20px;font-weight:700;letter-spacing:.08em">AUTO<span style="color:#3b82f6">LAB</span></td></tr>
<tr><td style="padding:28px 32px"><h1 style="margin:0 0 16px;font-size:22px">${esc(title)}</h1>${body}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #262a31;font-size:12px;color:#8b919a">
${esc(site.name)} · ${esc(addr.street)}, ${esc(addr.city)}, ${esc(addr.region)} ${esc(addr.postalCode)} · ${esc(site.phone)}
</td></tr></table></td></tr></table></body></html>`;
}

function detailsTable(b: BookingForNotice) {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#8b919a;width:140px">${k}</td><td style="padding:6px 0">${v}</td></tr>`;
  const balance = b.priceCents - (b.depositPaidAt ? b.depositCents : 0);
  return `<table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px">
${row("Reference", esc(b.reference))}
${row("Service", esc(b.serviceName))}
${row("Vehicle", esc(`${b.vehicle.year} ${b.vehicle.make} ${b.vehicle.model}`))}
${row("When", esc(formatWhen(b.startAt, b.endAt)))}
${row("Estimated total", formatMoney(b.priceCents))}
${b.depositPaidAt ? row("Deposit paid", formatMoney(b.depositCents)) : ""}
${row("Balance due at pickup", formatMoney(balance))}
</table>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = env.email.resendKey;
  if (!key) {
    console.info(`[email:dev] to=${to} subject="${subject}"`);
    return;
  }
  try {
    const { error } = await new Resend(key).emails.send({ from: env.email.from, to, subject, html });
    if (error) console.error("[email] send failed", error);
  } catch (err) {
    console.error("[email] send threw", err);
  }
}

async function sendSms(to: string, body: string) {
  const { sid, token, from } = env.sms;
  if (!sid || !token || !from) {
    console.info(`[sms:dev] to=${to} body="${body}"`);
    return;
  }
  try {
    await twilio(sid, token).messages.create({ to: toE164(to), from, body });
  } catch (err) {
    console.error("[sms] send failed", err);
  }
}

const smsFooter = " Reply STOP to opt out.";

export async function notifyBookingConfirmed(b: BookingForNotice) {
  const policy = `Need to change something? Call ${esc(site.phone)} at least ${site.policies.cancellationNoticeHours} hours before your appointment.`;
  await Promise.all([
    sendEmail(
      b.customer.email,
      `You're booked — ${b.serviceName} (${b.reference})`,
      layout(
        `See you soon, ${b.customer.name.split(" ")[0]}.`,
        `<p style="color:#c4c8ce;line-height:1.6">Your appointment is confirmed.</p>${detailsTable(b)}
<p style="color:#8b919a;font-size:13px;line-height:1.6;margin-top:20px">${policy}</p>`,
      ),
    ),
    b.customer.smsOptIn &&
      sendSms(
        b.customer.phone,
        `Auto Lab: you're booked for ${b.serviceName}, ${formatWhen(b.startAt, b.endAt)}. Ref ${b.reference}.${smsFooter}`,
      ),
    env.email.shopInbox &&
      sendEmail(
        env.email.shopInbox,
        `New booking ${b.reference}: ${b.serviceName}`,
        layout(
          "New booking",
          `${detailsTable(b)}<p style="margin-top:16px">${esc(b.customer.name)} · ${esc(b.customer.email)} · ${esc(b.customer.phone)}</p>`,
        ),
      ),
  ]);
}

export async function notifyReminder(b: BookingForNotice) {
  await Promise.all([
    sendEmail(
      b.customer.email,
      `Reminder: ${b.serviceName} tomorrow`,
      layout(
        "Your appointment is coming up",
        `${detailsTable(b)}<p style="color:#c4c8ce;line-height:1.6;margin-top:16px">Please remove personal items and arrive on time. Questions? Call ${esc(site.phone)}.</p>`,
      ),
    ),
    b.customer.smsOptIn &&
      sendSms(
        b.customer.phone,
        `Auto Lab reminder: ${b.serviceName}, ${formatWhen(b.startAt, b.endAt)}. Questions? ${site.phone}.${smsFooter}`,
      ),
  ]);
}

export async function notifyPaymentLink(b: BookingForNotice, url: string) {
  await Promise.all([
    sendEmail(
      b.customer.email,
      `Secure your appointment — ${b.serviceName}`,
      layout(
        "Your quote is ready",
        `${detailsTable(b)}
<p style="margin:24px 0"><a href="${esc(url)}" style="background:#3b82f6;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Pay ${formatMoney(b.depositCents)} deposit</a></p>
<p style="color:#8b919a;font-size:13px">This link holds your slot for about 24 hours.</p>`,
      ),
    ),
    b.customer.smsOptIn &&
      sendSms(b.customer.phone, `Auto Lab: pay your deposit to lock in ${b.serviceName}: ${url}${smsFooter}`),
  ]);
}

export async function notifyCancelled(b: BookingForNotice, refunded: boolean) {
  await sendEmail(
    b.customer.email,
    `Booking cancelled — ${b.reference}`,
    layout(
      "Your booking was cancelled",
      `${detailsTable(b)}<p style="color:#c4c8ce;margin-top:16px">${
        refunded
          ? "Your deposit has been refunded. It can take 5–10 business days to appear."
          : `If you think this is a mistake, call us at ${esc(site.phone)}.`
      }</p>`,
    ),
  );
}

export async function notifyNewQuote(q: {
  name: string;
  email: string;
  phone: string;
  category: string;
  vehicle: string;
  message?: string | null;
}) {
  await Promise.all([
    sendEmail(
      q.email,
      "We got your quote request",
      layout(
        `Thanks, ${q.name.split(" ")[0]}.`,
        `<p style="color:#c4c8ce;line-height:1.6">We'll review your ${esc(q.vehicle)} and get back to you within one business day with a price and available dates.</p>`,
      ),
    ),
    env.email.shopInbox &&
      sendEmail(
        env.email.shopInbox,
        `New quote request: ${q.category} — ${q.vehicle}`,
        layout(
          "New quote request",
          `<p>${esc(q.name)} · ${esc(q.email)} · ${esc(q.phone)}</p><p>${esc(q.vehicle)}</p><p>${esc(q.message ?? "")}</p>`,
        ),
      ),
  ]);
}
