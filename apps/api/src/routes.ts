/**
 * Route table. The single place that decides what is public and what needs a
 * session — reading this file tells you the whole authorization story.
 */

import { Router } from "express";
import { requireSession } from "@/middleware/auth.middleware.js";
import { authRouter } from "@/modules/auth/auth.routes.js";
import { checkTemplatesRouter } from "@/modules/checks/templates.routes.js";
import { deliveriesRouter } from "@/modules/deliveries/deliveries.routes.js";
import { dossierRouter } from "@/modules/dossier/dossier.routes.js";
import { modelsRouter } from "@/modules/models/models.routes.js";
import { promptsRouter } from "@/modules/prompts/prompts.routes.js";
import { repositoriesRouter } from "@/modules/repositories/repositories.routes.js";
import { settingsRouter } from "@/modules/settings/settings.routes.js";
import { statsRouter } from "@/modules/stats/stats.routes.js";

export const apiRouter: Router = Router();

// Public: the panel needs these before a session exists.
apiRouter.use("/auth", authRouter);

// Everything else requires a valid session cookie.
apiRouter.use("/repositories", requireSession, repositoriesRouter);
apiRouter.use("/prompts", requireSession, promptsRouter);
apiRouter.use("/settings", requireSession, settingsRouter);
apiRouter.use("/models", requireSession, modelsRouter);
apiRouter.use("/stats", requireSession, statsRouter);
apiRouter.use("/deliveries", requireSession, deliveriesRouter);
apiRouter.use("/dossiers", requireSession, dossierRouter);
apiRouter.use("/check-templates", requireSession, checkTemplatesRouter);
