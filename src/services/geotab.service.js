import { config } from "../config/index.js";
import { fetchJson } from "../utils/httpClient.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

const LABEL = "MyGeotab";

/** Verified sessions, keyed by database + user + session id. */
const cache = new Map();

const keyFor = ({ database, userName, sessionId }) =>
  `${database}::${userName}::${sessionId}`;

function prune() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expires <= now) cache.delete(key);
  }
}

function hostOf(server) {
  return String(server ?? "")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .toLowerCase();
}

/**
 * The caller supplies the server to verify against, so an unchecked value
 * would let someone name a server of their own that approves any session.
 */
function serverIsAllowed(server) {
  const host = hostOf(server);
  if (!host) return false;

  return config.geotab.allowedServers.some((allowed) => {
    const pattern = allowed.toLowerCase();
    return pattern.startsWith("*.")
      ? host.endsWith(pattern.slice(1))
      : host === pattern;
  });
}

/**
 * Confirms a session is real by making an authenticated call with it.
 * MyGeotab answers with an error object rather than a non-200 status when
 * credentials are rejected, so the body must be inspected.
 */
async function askGeotab({ server, database, userName, sessionId }) {
  const { body } = await fetchJson(`https://${hostOf(server)}/apiv1`, {
    label: LABEL,
    timeoutMs: 10000,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "Get",
      params: {
        typeName: "User",
        search: { name: userName },
        credentials: { database, userName, sessionId }
      }
    })
  });

  if (body.error) {
    logger.debug("MyGeotab rejected a session", { reason: body.error.message });
    return null;
  }

  const user = Array.isArray(body.result) ? body.result[0] : null;
  if (!user) return null;

  return { id: user.id, name: user.name, database };
}

/** The verified user, or null when the session is not valid. */
export async function verifySession(session) {
  const { server, database, userName, sessionId } = session;

  if (!server || !database || !userName || !sessionId) {
    throw ApiError.badRequest("Incomplete MyGeotab session");
  }

  if (!serverIsAllowed(server)) {
    throw ApiError.forbidden("That MyGeotab server is not permitted");
  }

  prune();

  const key = keyFor(session);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.user;

  const user = await askGeotab(session);
  if (user) {
    cache.set(key, {
      user,
      expires: Date.now() + config.geotab.sessionTtlSeconds * 1000
    });
    logger.debug("Session verified", { user: user.name });
  }

  return user;
}

/** Exposed for tests and diagnostics. */
export const _cache = cache;
