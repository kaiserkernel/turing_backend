import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
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

const addinIndexTemplate = readFileSync(
  path.join(__dirname, "..", "addin", "index.html"),
  "utf8"
);

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
      },
      // Helmet's default (same-origin) blocks MyGeotab's page from loading our
      // static JS/API responses at all - the entire point of this service is
      // to be loaded cross-origin from MyGeotab.
      crossOriginResourcePolicy: { policy: "cross-origin" }
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
  app.get(["/addin", "/addin/", "/addin/index.html"], (req, res) => {
    // MyGeotab fetches this page's HTML/JS and runs it as part of its own
    // document rather than a genuinely separate origin, so a relative fetch()
    // inside addin.js resolves against my.geotab.com, not this backend. Telling
    // the page its own real address here lets it build absolute API URLs instead.
    const backendOrigin = `${req.protocol}://${req.get("host")}`;
    const html = addinIndexTemplate.replace(
      "</head>",
      `<script>` +
        `window.__TURING_BACKEND__ = ${JSON.stringify(backendOrigin)};` +
        `window.__TURING_DASHBOARD_URL__ = ${JSON.stringify(config.turing.dashboardUrl)};` +
        `</script></head>`
    );
    res.set("Cache-Control", "no-store").type("html").send(html);
  });
  app.use(
    "/addin",
    // Not for production: while this is actively being edited, a stale cached
    // copy that MyGeotab's own fetch-based loader picked up is indistinguishable
    // from a real bug. Revisit once the Add-In is stable.
    express.static(path.join(__dirname, "..", "addin"), {
      etag: false,
      lastModified: false,
      cacheControl: false,
      setHeaders: (res) => res.setHeader("Cache-Control", "no-store")
    })
  );
  app.use("/api", apiRateLimit, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
