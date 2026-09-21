/**
 * An error with an HTTP status attached. Anything thrown that is not an
 * ApiError is treated as a 500 and its message is not shown to the caller.
 */
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Not authenticated") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Not permitted") {
    return new ApiError(403, message);
  }

  static notFound(message = "Not found") {
    return new ApiError(404, message);
  }

  static badGateway(message, details) {
    return new ApiError(502, message, details);
  }

  static timeout(message = "Upstream did not respond in time") {
    return new ApiError(504, message);
  }
}
