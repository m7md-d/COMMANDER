import type { Request, Response } from "express";
import type { RepositoryInput, RepositoryUpdate } from "@commander/shared";
import { WEBHOOK_PATH } from "@/config/constants.js";
import { env } from "@/config/env.js";
import { BadRequestError } from "@/core/errors/app-error.js";
import { created, noContent, ok } from "@/core/http/respond.js";
import { validated } from "@/middleware/validate.middleware.js";
import {
  createRepository,
  deleteRepository,
  getRepository,
  listRepositories,
  updateRepository,
} from "./repositories.service.js";
import { readStructureDigest, scanRepository } from "./scan.service.js";
import { readSnapshot } from "@/modules/tree/tree.read.js";

function requireId(req: Request): string {
  const id = req.params.id;
  if (!id) throw new BadRequestError();
  return id;
}

export async function list(_req: Request, res: Response): Promise<void> {
  ok(res, {
    repositories: await listRepositories(),
    // The panel shows this verbatim for pasting into GitHub, so it is derived
    // from PUBLIC_URL rather than from whatever host the browser used.
    webhookUrl: `${env.PUBLIC_URL.replace(/\/$/, "")}${WEBHOOK_PATH}`,
  });
}

export async function read(req: Request, res: Response): Promise<void> {
  ok(res, await getRepository(requireId(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  created(res, await createRepository(validated<RepositoryInput>(req)));
}

/** Reads the repository once to import its contributors and learn its layout. */
export async function scan(req: Request, res: Response): Promise<void> {
  ok(res, await scanRepository(requireId(req)));
}

/**
 * The cached layout digest. Separate from the repository payload rather than
 * folded into it: the list returns every front, and a digest per front is
 * weight that only the one open sheet ever reads.
 */
export async function structure(req: Request, res: Response): Promise<void> {
  ok(res, { structure: await readStructureDigest(requireId(req)) });
}

/**
 * The stored file tree. Its own endpoint for the same reason the digest is: the
 * list returns every front, and thousands of file rows are weight that only the
 * one open sheet ever reads.
 */
export async function tree(req: Request, res: Response): Promise<void> {
  ok(res, await readSnapshot(requireId(req)));
}

export async function update(req: Request, res: Response): Promise<void> {
  ok(res, await updateRepository(requireId(req), validated<RepositoryUpdate>(req)));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await deleteRepository(requireId(req));
  noContent(res);
}
