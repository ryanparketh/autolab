import "server-only";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { env } from "./env";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./session";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;
// Compared against when the email is wrong, so response time doesn't reveal it.
let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("not-the-password", 12));

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const ip = await clientIp();
  const since = new Date(Date.now() - WINDOW_MS);
  const failures = await db.loginAttempt.count({ where: { ip, createdAt: { gt: since } } });
  if (failures >= MAX_FAILURES) {
    return { ok: false, error: "Too many attempts. Try again in 15 minutes." };
  }

  const hash = env.adminPasswordHash;
  if (!hash) return { ok: false, error: "Admin login is not configured (ADMIN_PASSWORD_HASH_B64)." };

  const emailOk = email.trim().toLowerCase() === env.adminEmail;
  const pwOk = await bcrypt.compare(password, emailOk ? hash : getDummyHash());
  if (!emailOk || !pwOk) {
    await db.loginAttempt.create({ data: { ip } });
    return { ok: false, error: "Invalid email or password." };
  }

  await db.loginAttempt.deleteMany({ where: { ip } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(env.adminEmail), {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return { ok: true };
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Authoritative check. Call at the top of every admin page and server action —
 * proxy.ts only does an optimistic redirect. */
export async function requireAdmin() {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || session.email !== env.adminEmail) redirect("/admin/login");
  return session;
}
