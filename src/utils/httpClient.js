import { ApiError } from "./ApiError.js";

/**
 * fetch with a timeout, returning parsed JSON.
 * `label` names the upstream service in any error raised.
 */
export async function fetchJson(url, { timeoutMs = 15000, label = "Upstream", ...init } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw ApiError.timeout(`${label} did not respond in time`);
    }
    throw ApiError.badGateway(`Could not reach ${label}`, { cause: err.message });
  } finally {
    clearTimeout(timer);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw ApiError.badGateway(`${label} returned an unreadable response`);
  }

  return { status: response.status, body };
}
