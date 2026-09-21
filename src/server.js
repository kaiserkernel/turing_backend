import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(`Listening on port ${config.port} (${config.env})`);
  logger.info(`Turing base URL: ${config.turing.baseUrl}`);
  logger.info(`Allowed MyGeotab servers: ${config.geotab.allowedServers.join(", ")}`);
  logger.info(
    config.turing.siteIds.length
      ? `Restricted to Turing sites: ${config.turing.siteIds.join(", ")}`
      : "No site restriction — exposing every site the token can reach"
  );
});

function shutdown(signal) {
  logger.info(`${signal} received, closing server`);
  server.close(() => {
    logger.info("Closed cleanly");
    process.exit(0);
  });
  // Don't hang indefinitely on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", reason);
});
