import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function list(name, fallback = "") {
  return (process.env[name] ?? fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function number(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  env: process.env.NODE_ENV ?? "development",
  port: number("PORT", 3000),
  isProduction: (process.env.NODE_ENV ?? "development") === "production",

  turing: {
    baseUrl: process.env.TURING_BASE_URL ?? "https://app.turingvideo.com",
    token: required("TURING_ACCESS_TOKEN"),
    // Empty means every site the token can reach.
    siteIds: list("TURING_SITE_IDS").map(Number).filter(Number.isFinite),
    // The human-facing Vision Dashboard - a different host from the API
    // base above. Linked from the Add-In, never called by this backend.
    dashboardUrl: process.env.TURING_DASHBOARD_URL ?? "https://ai-video.turingvideo.com/dashboard"
  },

  geotab: {
    // A caller names the server to verify against, so an unchecked value would
    // let someone point at a server of their own that approves any session.
    allowedServers: list("GEOTAB_ALLOWED_SERVERS", "my.geotab.com"),
    sessionTtlSeconds: number("GEOTAB_SESSION_TTL", 300)
  },

  cors: {
    // Blank allows any origin. Set this to the Add-In host in production.
    origins: list("CORS_ORIGINS")
  },

  rateLimit: {
    windowMs: 60_000,
    max: number("RATE_LIMIT_MAX", 120)
  }
};
