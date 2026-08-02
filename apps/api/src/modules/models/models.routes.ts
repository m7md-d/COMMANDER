import { Router } from "express";
import { asyncHandler } from "@/core/http/async-handler.js";
import { list } from "./models.controller.js";

export const modelsRouter: Router = Router();

modelsRouter.get("/", asyncHandler(list));
