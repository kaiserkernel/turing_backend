import { Router } from "express";
import * as controller from "../controllers/cameras.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const camerasRouter = Router();

camerasRouter.get("/", asyncHandler(controller.index));
camerasRouter.post("/:id/stream", asyncHandler(controller.stream));
