import { Router } from "express";
import { camerasRouter } from "./cameras.routes.js";
import { requireGeotabSession } from "../middleware/auth.middleware.js";

export const apiRouter = Router();

// Everything below /api requires a valid MyGeotab session.
apiRouter.use(requireGeotabSession);
apiRouter.use("/cameras", camerasRouter);
