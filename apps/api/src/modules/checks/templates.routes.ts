import { Router } from "express";
import { checkTemplateInputSchema } from "@commander/shared";
import { asyncHandler } from "@/core/http/async-handler.js";
import { validate } from "@/middleware/validate.middleware.js";
import { create, list, remove, update } from "./templates.controller.js";

export const checkTemplatesRouter: Router = Router();

checkTemplatesRouter.get("/", asyncHandler(list));
checkTemplatesRouter.post("/", validate(checkTemplateInputSchema), asyncHandler(create));
checkTemplatesRouter.put("/:id", validate(checkTemplateInputSchema), asyncHandler(update));
checkTemplatesRouter.delete("/:id", asyncHandler(remove));
