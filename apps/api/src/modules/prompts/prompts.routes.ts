import { Router } from "express";
import { promptInputSchema } from "@commander/shared";
import { asyncHandler } from "@/core/http/async-handler.js";
import { validate } from "@/middleware/validate.middleware.js";
import { create, list, remove, update } from "./prompts.controller.js";

export const promptsRouter: Router = Router();

promptsRouter.get("/", asyncHandler(list));
promptsRouter.post("/", validate(promptInputSchema), asyncHandler(create));
promptsRouter.put("/:id", validate(promptInputSchema), asyncHandler(update));
promptsRouter.delete("/:id", asyncHandler(remove));
