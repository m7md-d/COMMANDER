/**
 * GitHub webhook authentication.
 *
 * The HMAC covers the exact bytes GitHub sent. The caller must pass the raw
 * body captured by the verify hook — re-serialising a parsed object produces
 * different bytes (key order, whitespace, unicode escaping) and the signature
 * would never match. This is CONSTITUTION.md §7 and the reason
 * raw-body.middleware.ts exists.
 */

import { env } from "@/config/env.js";
import { hmacHex, timingSafeEqual } from "@/core/crypto/hmac.js";

export function verifyGitHubSignature(rawBody: string, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) return false;
  return timingSafeEqual(`sha256=${hmacHex(env.GITHUB_WEBHOOK_SECRET, rawBody)}`, signatureHeader);
}
