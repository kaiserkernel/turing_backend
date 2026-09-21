import { config } from "../config/index.js";
import { fetchJson } from "../utils/httpClient.js";
import { ApiError } from "../utils/ApiError.js";

const LABEL = "Turing";

/**
 * Turing wraps every response in { err: { ec, em }, ret: {...} }.
 * A non-zero `ec` is an application error even when the HTTP status is 200,
 * so the body has to be inspected rather than the status alone.
 */
async function call(path, { method = "GET", body } = {}) {
  const { status, body: payload } = await fetchJson(`${config.turing.baseUrl}${path}`, {
    label: LABEL,
    method,
    headers: {
      Authorization: `Bearer ${config.turing.token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (status === 401 || status === 403) {
    // Reported as 502: the caller's credentials are fine, this service's are not.
    throw ApiError.badGateway("Turing rejected the service credentials");
  }

  if (payload?.err?.ec !== 0) {
    throw ApiError.badGateway(payload?.err?.em || "Turing request failed", {
      turingCode: payload?.err?.ec
    });
  }

  return payload.ret;
}

function toCamera(raw) {
  return {
    id: raw.id,
    name: raw.name,
    siteId: raw.site_id,
    state: raw.state,
    online: raw.state === "running",
    model: raw.model,
    manufacturer: raw.manufacturer
  };
}

/** Cameras the token can see, narrowed to configured sites when set. */
export async function listCameras({ limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams({
    limit: String(Math.min(limit, 50)),
    offset: String(offset)
  });
  for (const id of config.turing.siteIds) {
    params.append("site_ids", String(id));
  }

  const ret = await call(`/openapi/nest/camera/cameras?${params}`);
  const cameras = (ret?.cameras ?? []).map(toCamera);

  return { total: ret?.total ?? cameras.length, offset, cameras };
}

/**
 * A playable HLS URL for one camera.
 *
 * The URL must be opened within roughly 10 minutes, after which it is dead.
 * Once playback starts it continues well past that window. A URL stops working
 * when playback ends, so these are issued per request and never cached.
 */
export async function getStreamUrl(cameraId, resolution = "sub") {
  if (!["main", "sub", "third"].includes(resolution)) {
    throw ApiError.badRequest("resolution must be main, sub or third");
  }

  const ret = await call("/openapi/nest/live/hls", {
    method: "POST",
    body: { camera_id: Number(cameraId), resolution }
  });

  if (!ret?.play_url) {
    throw ApiError.badGateway("Turing did not return a stream URL");
  }

  return {
    cameraId: Number(cameraId),
    playUrl: ret.play_url,
    resolution,
    issuedAt: new Date().toISOString(),
    // Informational: how long the caller has to start playback.
    startWithinSeconds: 600
  };
}

/** Whether a camera is one this service is configured to expose. */
export async function cameraIsPermitted(cameraId) {
  if (config.turing.siteIds.length === 0) return true;
  const { cameras } = await listCameras({ limit: 50 });
  return cameras.some((c) => c.id === Number(cameraId));
}
