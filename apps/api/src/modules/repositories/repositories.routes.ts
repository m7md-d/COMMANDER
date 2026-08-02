import { Router } from "express";
import { repositoryInputSchema, repositoryUpdateSchema } from "@commander/shared";
import { asyncHandler } from "@/core/http/async-handler.js";
import { validate } from "@/middleware/validate.middleware.js";
import {
  create,
  list,
  read,
  remove,
  scan,
  structure,
  tree,
  update,
} from "./repositories.controller.js";

export const repositoriesRouter: Router = Router();

repositoriesRouter.get("/", asyncHandler(list));
repositoriesRouter.post("/", validate(repositoryInputSchema), asyncHandler(create));
repositoriesRouter.get("/:id", asyncHandler(read));
repositoriesRouter.patch("/:id", validate(repositoryUpdateSchema), asyncHandler(update));
repositoriesRouter.delete("/:id", asyncHandler(remove));
// Takes only the repository id: what is read is fixed by the stored config, so
// a session holder cannot point the server at an arbitrary repo.
repositoriesRouter.post("/:id/scan", asyncHandler(scan));
repositoriesRouter.get("/:id/structure", asyncHandler(structure));
repositoriesRouter.get("/:id/tree", asyncHandler(tree));
