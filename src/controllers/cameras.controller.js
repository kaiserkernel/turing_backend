import {
  listCameras,
  getStreamUrl,
  cameraIsPermitted
} from "../services/turing.service.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

/** GET /api/cameras */
export async function index(req, res) {
  const limit = Math.min(Number(req.query.limit) || 50, 50);
  const offset = Number(req.query.offset) || 0;

  res.json(await listCameras({ limit, offset }));
}

/**
 * POST /api/cameras/:id/stream
 *
 * Issued fresh on every call. Stream URLs cannot be reused once playback
 * stops, so caching them would hand out dead links.
 */
export async function stream(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    throw ApiError.badRequest("Invalid camera id");
  }

  if (!(await cameraIsPermitted(id))) {
    throw ApiError.notFound("Camera not found");
  }

  const resolution = req.body?.resolution ?? "sub";
  const result = await getStreamUrl(id, resolution);

  logger.info(
    `Stream issued camera=${id} resolution=${resolution} user=${req.user.name}`
  );

  res.json(result);
}
