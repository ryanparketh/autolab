// Edge-safe session token helpers (used by proxy.ts and server code).
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "al_admin";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

export async function signSession(email: string): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<{ email: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.role !== "admin" || !payload.sub) return null;
    return { email: payload.sub };
  } catch {
    return null;
  }
}
