import type { Request, Response } from "express";
import { PROMPT_VARIABLES, type PromptInput } from "@commander/shared";
import { created, noContent, ok } from "@/core/http/respond.js";
import { BadRequestError } from "@/core/errors/app-error.js";
import { validated } from "@/middleware/validate.middleware.js";
import { promptRetainsGuard } from "@/domain/report/sanitize.js";
import {
  createPrompt,
  deletePrompt,
  listPrompts,
  updatePrompt,
} from "./prompts.service.js";

function requireId(req: Request): string {
  const id = req.params.id;
  if (!id) throw new BadRequestError();
  return id;
}

export async function list(_req: Request, res: Response): Promise<void> {
  ok(res, {
    prompts: await listPrompts(),
    variables: PROMPT_VARIABLES,
  });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = validated<PromptInput>(req);
  created(res, {
    prompt: await createPrompt(input),
    // Advisory, not blocking: the operator owns their prompt, but should not
    // drop the injection guard without noticing.
    guardRetained: promptRetainsGuard(input.system),
  });
}

export async function update(req: Request, res: Response): Promise<void> {
  const input = validated<PromptInput>(req);
  ok(res, {
    prompt: await updatePrompt(requireId(req), input),
    guardRetained: promptRetainsGuard(input.system),
  });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await deletePrompt(requireId(req));
  noContent(res);
}
