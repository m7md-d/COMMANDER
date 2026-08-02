/**
 * GitHub App authentication.
 *
 * Two-step by design: the app's private key signs a short JWT proving app
 * identity, and that JWT is exchanged for an *installation* token scoped to one
 * account's repositories. The installation token is what every API call uses.
 *
 * Why an App rather than a PAT: tokens live one hour instead of forever, the
 * rate limit is per installation rather than per human, and revoking access is
 * uninstalling — no shared long-lived credential to leak.
 */

import { createSign } from "node:crypto";
import { env } from "@/config/env.js";
import { createLogger } from "@/core/logger/logger.js";

const log = createLogger("github-auth");
const API = "https://api.github.com";

/** GitHub rejects a JWT older than 10 minutes; 9 leaves room for clock skew. */
const JWT_TTL_SECONDS = 9 * 60;
/** Installation tokens last an hour; refresh early rather than racing expiry. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1_000;

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * RS256 JWT signed with the app's private key. Written by hand rather than
 * pulling a JWT library for one algorithm and two claims.
 */
function createAppJwt(): string {
  const now = Math.floor(Date.now() / 1_000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      // Backdated 60s: GitHub rejects a token whose iat is in the future, and
      // container clocks drift.
      iat: now - 60,
      exp: now + JWT_TTL_SECONDS,
      iss: env.GITHUB_APP_ID,
    }),
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(normalizePrivateKey(env.GITHUB_APP_PRIVATE_KEY), "base64url");

  return `${header}.${payload}.${signature}`;
}

/**
 * A PEM cannot survive a .env line, so it is stored with literal `\n` escapes
 * (or base64) and restored here.
 */
export function normalizePrivateKey(raw: string): string {
  if (raw.includes("-----BEGIN")) return raw.replace(/\\n/g, "\n");
  return Buffer.from(raw, "base64").toString("utf8");
}

export function isGitHubAppConfigured(): boolean {
  return env.GITHUB_APP_ID.length > 0 && env.GITHUB_APP_PRIVATE_KEY.length > 0;
}

interface InstallationTokenResponse {
  token?: string;
  expires_at?: string;
  message?: string;
}

/**
 * @returns a bearer token for the installation, or null when the App is not
 * configured or GitHub refuses. Null is a normal outcome — every caller
 * degrades to webhook-only data rather than failing the delivery.
 */
export async function getInstallationToken(installationId: string): Promise<string | null> {
  if (!isGitHubAppConfigured() || !installationId) return null;

  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
    return cached.token;
  }

  try {
    const response = await fetch(`${API}/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${createAppJwt()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    const body = (await response.json()) as InstallationTokenResponse;

    if (!response.ok || !body.token) {
      log.warn("installation token refused", { status: response.status, message: body.message });
      return null;
    }

    tokenCache.set(installationId, {
      token: body.token,
      expiresAt: body.expires_at ? Date.parse(body.expires_at) : Date.now() + 3_600_000,
    });

    return body.token;
  } catch (error) {
    log.warn("installation token request failed", { error: String(error) });
    return null;
  }
}

/** Called when a repository is removed so its token does not linger in memory. */
export function forgetInstallation(installationId: string): void {
  tokenCache.delete(installationId);
}
