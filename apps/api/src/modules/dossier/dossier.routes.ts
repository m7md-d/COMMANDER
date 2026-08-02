import { Router } from "express";
import { dossierRefreshSchema, noteInputSchema } from "@commander/shared";
import { asyncHandler } from "@/core/http/async-handler.js";
import { validate } from "@/middleware/validate.middleware.js";
import { createNote, list, read, regenerate, removeNote } from "./dossier.controller.js";

export const dossierRouter: Router = Router();

dossierRouter.get("/:repositoryId", asyncHandler(list));
dossierRouter.get("/:repositoryId/:login", asyncHandler(read));
dossierRouter.post(
  "/:repositoryId/:login/regenerate",
  validate(dossierRefreshSchema),
  asyncHandler(regenerate),
);
dossierRouter.post(
  "/:repositoryId/:login/notes",
  validate(noteInputSchema),
  asyncHandler(createNote),
);
dossierRouter.delete("/notes/:noteId", asyncHandler(removeNote));
