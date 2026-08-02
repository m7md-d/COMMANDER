import type { Request, Response } from "express";
import type { DossierRefresh, NoteInput } from "@commander/shared";
import { BadRequestError } from "@/core/errors/app-error.js";
import { created, noContent, ok } from "@/core/http/respond.js";
import { validated } from "@/middleware/validate.middleware.js";
import { addNote, deleteNote, getDossier } from "./dossier.read.js";
import { listDossiers } from "./roster.read.js";
import { refreshNarrative } from "./narrative.service.js";

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) throw new BadRequestError();
  return value;
}

export async function list(req: Request, res: Response): Promise<void> {
  ok(res, await listDossiers(param(req, "repositoryId")));
}

export async function read(req: Request, res: Response): Promise<void> {
  ok(res, await getDossier(param(req, "repositoryId"), param(req, "login")));
}

/**
 * Manual regeneration. `force` exists because an operator may want the prose
 * rewritten after editing the prompt, even though the facts have not moved.
 */
export async function regenerate(req: Request, res: Response): Promise<void> {
  const { force } = validated<DossierRefresh>(req);
  const repositoryId = param(req, "repositoryId");
  const login = param(req, "login");

  const written = await refreshNarrative(repositoryId, login, { force });
  ok(res, { regenerated: written, dossier: await getDossier(repositoryId, login) });
}

export async function createNote(req: Request, res: Response): Promise<void> {
  const input = validated<NoteInput>(req);
  created(
    res,
    await addNote({
      repositoryId: param(req, "repositoryId"),
      login: param(req, "login"),
      body: input.body,
      ...(input.expiresInDays !== undefined && { expiresInDays: input.expiresInDays }),
    }),
  );
}

export async function removeNote(req: Request, res: Response): Promise<void> {
  await deleteNote(param(req, "noteId"));
  noContent(res);
}
