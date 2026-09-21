import path from "node:path";
import { fileURLToPath } from "node:url";
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // MyGeotab embeds the Add-In page in an iframe from its own domain.
          // Helmet's default frame-ancestors is 'self', which would block that.
          "frame-ancestors": [
            "'self'",
            ...config.geotab.allowedServers.map((server) => `https://${server}`)
          ],
          // hls.js and <video> fetch stream data straight from Turing's media host.
          "media-src": ["'self'", "https://*.turingvideo.com"],
          "connect-src": ["'self'", "https://*.turingvideo.com"]
        }
      }
    })
  );
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
  app.use("/addin", express.static(path.join(__dirname, "..", "addin")));
  app.use("/api", apiRateLimit, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
