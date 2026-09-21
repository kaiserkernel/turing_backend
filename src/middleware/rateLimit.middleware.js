import rateLimit from "express-rate-limit";
import { config } from "../config/index.js";

export const apiRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" }
});
