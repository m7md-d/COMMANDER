import type { SecretStatus, SessionState } from "@commander/shared";
import { env, secretStatus } from "@/config/env.js";
import { timingSafeEqual } from "@/core/crypto/hmac.js";
import { issueSession, verifySession, type IssuedSession } from "@/core/crypto/session-token.js";
import { UnauthorizedError } from "@/core/errors/app-error.js";

/**
 * There is one credential and it lives in the environment, so this service
 * touches no database. Keeping it a service anyway means the controller stays
 * free of policy (§2).
 */

export function isPanelConfigured(): boolean {
  return env.DASHBOARD_PASSWORD.length > 0;
}

export function authenticate(password: string): IssuedSession {
  if (!isPanelConfigured()) {
    throw new UnauthorizedError("auth.notConfigured");
  }

  if (!timingSafeEqual(env.DASHBOARD_PASSWORD, password)) {
    throw new UnauthorizedError("auth.invalidPassword");
  }

  return issueSession();
}

export function describeSession(token: string | undefined): SessionState {
  return {
    authenticated: verifySession(token),
    configured: isPanelConfigured(),
  };
}

export function readSecretStatus(): SecretStatus {
  return secretStatus();
}
