import type { Request, Response } from "express";
import { ok } from "@/core/http/respond.js";
import { listModels } from "./models.service.js";

export async function list(_req: Request, res: Response): Promise<void> {
  ok(res, await listModels());
}
