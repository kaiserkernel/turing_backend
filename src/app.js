import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";

import { config } from "./config/index.js";
import { apiRouter } from "./routes/index.js";
import { healthRouter } from "./routes/health.routes.js";
import { apiRateLimit } from "./middleware/rateLimit.middleware.js";
import { requestLog } from "./middleware/requestLog.middleware.js";
import {
  notFoundHandler,
  errorHandler
} from "./middleware/error.middleware.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: "16kb" }));
  app.use(requestLog);

  app.use(
    cors({
      origin: config.cors.origins.length ? config.cors.origins : true,
      allowedHeaders: [
        "Content-Type",
        "x-geotab-server",
        "x-geotab-database",
        "x-geotab-user",
        "x-geotab-session"
      ]
    })
  );

  app.use("/health", healthRouter);
  app.use("/api", apiRateLimit, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
