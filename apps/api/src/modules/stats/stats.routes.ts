import { Router } from "express";
import { asyncHandler } from "@/core/http/async-handler.js";
import { members, overview, reset } from "./stats.controller.js";

export const statsRouter: Router = Router();

statsRouter.get("/overview", asyncHandler(overview));
statsRouter.get("/repositories/:repositoryId", asyncHandler(members));
statsRouter.delete("/repositories/:repositoryId", asyncHandler(reset));
