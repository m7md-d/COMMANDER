import type { Request, Response } from "express";
import { DEFAULT_CHECKS, type CheckTemplateInput } from "@commander/shared";
import { created, noContent, ok } from "@/core/http/respond.js";
import { BadRequestError } from "@/core/errors/app-error.js";
import { validated } from "@/middleware/validate.middleware.js";
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
} from "./templates.service.js";

function requireId(req: Request): string {
  const id = req.params.id;
  if (!id) throw new BadRequestError();
  return id;
}

/**
 * The templates plus the defaults they layer over. Sent together because the
 * editor has to show what a field falls back to when it is left blank — a
 * placeholder invented in the panel would drift from the engine's own numbers.
 */
export async function list(_req: Request, res: Response): Promise<void> {
  ok(res, { templates: await listTemplates(), defaults: DEFAULT_CHECKS });
}

export async function create(req: Request, res: Response): Promise<void> {
  created(res, await createTemplate(validated<CheckTemplateInput>(req)));
}

export async function update(req: Request, res: Response): Promise<void> {
  ok(res, await updateTemplate(requireId(req), validated<CheckTemplateInput>(req)));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await deleteTemplate(requireId(req));
  noContent(res);
}
