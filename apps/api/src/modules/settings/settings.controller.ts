import type { Request, Response } from "express";
import type { SettingsUpdate } from "@commander/shared";
import { ok } from "@/core/http/respond.js";
import { validated } from "@/middleware/validate.middleware.js";
import { readSecretStatus } from "@/modules/auth/auth.service.js";
import { getSettings, updateSettings } from "./settings.service.js";

export async function read(_req: Request, res: Response): Promise<void> {
  ok(res, await getSettings());
}

export async function update(req: Request, res: Response): Promise<void> {
  ok(res, await updateSettings(validated<SettingsUpdate>(req)));
}

/** Presence only — §7 forbids returning any secret value. */
export function secrets(_req: Request, res: Response): void {
  ok(res, readSecretStatus());
}
