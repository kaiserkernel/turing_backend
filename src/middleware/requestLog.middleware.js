import { logger } from "../utils/logger.js";

export function requestLog(req, res, next) {
  const started = Date.now();
  res.on("finish", () => {
    logger.info(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`
    );
  });
  next();
}
