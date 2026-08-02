import { Router } from "express";
import { settingsUpdateSchema } from "@commander/shared";
import { asyncHandler } from "@/core/http/async-handler.js";
import { validate } from "@/middleware/validate.middleware.js";
import { read, secrets, update } from "./settings.controller.js";

export const settingsRouter: Router = Router();

settingsRouter.get("/", asyncHandler(read));
settingsRouter.patch("/", validate(settingsUpdateSchema), asyncHandler(update));
settingsRouter.get("/secrets", secrets);
