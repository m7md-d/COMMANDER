/**
 * One PrismaClient per process. Creating one per request exhausts the
 * connection pool, and creating one per module makes transactions unshareable.
 *
 * Only services import this. CONSTITUTION.md §2 forbids controllers and the
 * domain layer from touching it.
 */

import { PrismaClient } from "@prisma/client";
import { isProduction } from "@/config/env.js";
import { createLogger } from "@/core/logger/logger.js";

const log = createLogger("db");

export const prisma = new PrismaClient({
  log: isProduction ? ["warn", "error"] : ["warn", "error"],
});

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  log.info("connected");
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  log.info("disconnected");
}

/** Prisma's unique-constraint code. Used to turn races into 409s. */
export const UNIQUE_VIOLATION = "P2025";
export const UNIQUE_CONSTRAINT = "P2002";

export function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === code
  );
}
