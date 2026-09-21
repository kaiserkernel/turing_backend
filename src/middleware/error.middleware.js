import { ApiError } from "../utils/ApiError.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

export function notFoundHandler(req, res) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const isKnown = err instanceof ApiError;
  const status = isKnown ? err.status : 500;
  const message = isKnown ? err.message : "Something went wrong";

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} failed`, err);
  } else {
    logger.debug(`${req.method} ${req.originalUrl} -> ${status}: ${message}`);
  }

  res.status(status).json({
    error: message,
    ...(err.details && !config.isProduction ? { details: err.details } : {})
  });
}
