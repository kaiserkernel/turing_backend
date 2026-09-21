import { verifySession } from "../services/geotab.service.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Requires a valid MyGeotab session.
 *
 * The Add-In obtains it from api.getSession() and sends it on each request.
 * None of it is secret: it is the caller's own session, and it is only useful
 * while MyGeotab still considers it valid.
 */
export const requireGeotabSession = asyncHandler(async (req, res, next) => {
  const session = {
    server: req.get("x-geotab-server"),
    database: req.get("x-geotab-database"),
    userName: req.get("x-geotab-user"),
    sessionId: req.get("x-geotab-session")
  };

  if (!session.sessionId) {
    throw ApiError.unauthorized("No MyGeotab session supplied");
  }

  const user = await verifySession(session);
  if (!user) {
    throw ApiError.unauthorized("MyGeotab session is not valid");
  }

  req.user = user;
  next();
});
