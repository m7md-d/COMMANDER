/**
 * Stateless session tokens: `<base64url(payload)>.<base64url(hmac)>`.
 *
 * Nothing secret lives inside the token — the signature is what makes it
 * unforgeable. That means no session table, no cleanup job, and logging out is
 * purely dropping the cookie. The trade-off is that a token cannot be revoked
 * before it expires; rotating SESSION_SECRET invalidates all of them at once.
 */

import { env } from "@/config/env.js";
import { SESSION_TTL_SECONDS } from "@/config/constants.js";
import { hmacBase64Url, timingSafeEqual } from "./hmac.js";

interface SessionPayload {
  iat: number;
  exp: number;
}

export interface IssuedSession {
  token: string;
  maxAgeSeconds: number;
}

export function issueSession(ttlSeconds = SESSION_TTL_SECONDS): IssuedSession {
  const now = Math.floor(Date.now() / 1_000);
  const payload: SessionPayload = { iat: now, exp: now + ttlSeconds };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = hmacBase64Url(env.SESSION_SECRET, encoded);

  return { token: `${encoded}.${signature}`, maxAgeSeconds: ttlSeconds };
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  // Signature first: never parse a payload we have not authenticated.
  if (!timingSafeEqual(hmacBase64Url(env.SESSION_SECRET, encoded), signature)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1_000);
  } catch {
    return false;
  }
}
