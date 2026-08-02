/**
 * CONSTITUTION.md §7: every secret comparison is constant time.
 *
 * `===` on strings returns at the first differing byte, so its runtime encodes
 * how many leading bytes an attacker guessed correctly. Over enough samples
 * that is enough to reconstruct a signature byte by byte.
 */

import { createHmac, timingSafeEqual as nodeTimingSafeEqual, randomBytes } from "node:crypto";

export function hmacHex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

export function hmacBase64Url(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("base64url");
}

/**
 * Node's timingSafeEqual throws when lengths differ, which would itself be a
 * side channel. Comparing digests of both inputs makes the buffers a fixed
 * length regardless of what was submitted, so length carries no information.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(hmacHex("length-normalizer", a), "hex");
  const bufferB = Buffer.from(hmacHex("length-normalizer", b), "hex");
  return nodeTimingSafeEqual(bufferA, bufferB);
}

export function randomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("hex");
}
