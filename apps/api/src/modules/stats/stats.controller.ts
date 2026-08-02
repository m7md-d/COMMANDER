import type { Request, Response } from "express";
import { BadRequestError } from "@/core/errors/app-error.js";
import { ok } from "@/core/http/respond.js";
import { getOverview, listMemberStats, resetStats } from "./stats.service.js";

function requireRepositoryId(req: Request): string {
  const id = req.params.repositoryId;
  if (!id) throw new BadRequestError();
  return id;
}

export async function overview(_req: Request, res: Response): Promise<void> {
  ok(res, await getOverview());
}

export async function members(req: Request, res: Response): Promise<void> {
  ok(res, await listMemberStats(requireRepositoryId(req)));
}

export async function reset(req: Request, res: Response): Promise<void> {
  ok(res, { deleted: await resetStats(requireRepositoryId(req)) });
}
