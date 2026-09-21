# Turing → MyGeotab backend

An Express service sitting between the MyGeotab Add-In and the Turing Vision
Open API.

It exists for one reason. The Turing access token works like a password to the
cameras and does not expire. A MyGeotab Add-In is client-side JavaScript, so
anything placed in it is readable by every user on the account. The token
therefore lives here, and the Add-In asks this service for camera data.

```
MyGeotab Add-In  ──▶  this service  ──▶  Turing Open API
   (no secrets)        (holds token)

Video itself goes browser ──▶ Turing media server, directly.
```

Video never passes through this service. The browser plays Turing's HLS stream
directly, so server bandwidth stays negligible no matter how many people watch.

## Requirements

Node 18 or newer.

## Setup

```bash
npm install
cp .env.example .env     # add TURING_ACCESS_TOKEN
npm run dev
```

Then:

```bash
./scripts/smoke-test.sh http://localhost:3000
```

## Layout

```
src/
  server.js                    entry point, listener, graceful shutdown
  app.js                       express app assembly
  config/
    index.js                   environment loading and validation
  routes/
    index.js                   /api router, auth applied here
    cameras.routes.js
    health.routes.js
  controllers/
    cameras.controller.js      request handling
  services/
    turing.service.js          Turing Open API client
    geotab.service.js          session verification
  middleware/
    auth.middleware.js
    error.middleware.js
    rateLimit.middleware.js
    requestLog.middleware.js
  utils/
    ApiError.js
    asyncHandler.js
    httpClient.js              fetch with timeout
    logger.js
```

Routes handle wiring, controllers handle requests, services talk to the outside
world. Nothing upstream is called from a controller directly, so swapping an
upstream or adding a database touches one layer.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `TURING_ACCESS_TOKEN` | yes | Vision Portal → Settings → Org Settings → Third-party Access Token |
| `TURING_BASE_URL` | no | Defaults to `https://app.turingvideo.com` |
| `TURING_SITE_IDS` | no | Restricts which sites are exposed. Blank exposes everything the token reaches |
| `GEOTAB_ALLOWED_SERVERS` | no | Hostnames accepted during session verification. Wildcards allowed |
| `GEOTAB_SESSION_TTL` | no | Seconds a verified session is trusted. Default 300 |
| `CORS_ORIGINS` | no | Add-In host. Blank allows any origin — development only |
| `RATE_LIMIT_MAX` | no | Requests per minute per IP. Default 120 |
| `PORT` | no | Default 3000 |
| `LOG_LEVEL` | no | error, warn, info, debug. Default info |

The service refuses to start without a Turing token.

## Authentication

Every `/api` route needs a MyGeotab session, supplied as headers:

```
x-geotab-server:   my.geotab.com
x-geotab-database: your_database
x-geotab-user:     user@example.com
x-geotab-session:  <session id>
```

The Add-In gets these from `api.getSession()`. The service verifies them by
making an authenticated call to MyGeotab; if MyGeotab rejects the session, the
request is refused. Verified sessions are cached for a few minutes so every
camera click does not trigger a round trip.

None of those values is a secret. They are the caller's own session and are
only useful while MyGeotab still accepts them.

`x-geotab-server` is checked against `GEOTAB_ALLOWED_SERVERS`. The caller
chooses which server to verify against, so without that check someone could
name a server of their own that approves any session and the whole auth layer
would be decorative.

## Endpoints

### `GET /health`

No authentication.

```json
{ "ok": true, "uptimeSeconds": 412, "timestamp": "2026-09-21T00:37:32.604Z" }
```

### `GET /api/cameras`

Query: `limit` (max 50), `offset`.

```json
{
  "total": 1,
  "offset": 0,
  "cameras": [
    {
      "id": 485618,
      "name": "EdgePlus camera 1",
      "siteId": 162928,
      "state": "running",
      "online": true,
      "model": "EVC5ZD",
      "manufacturer": "Turing-E"
    }
  ]
}
```

### `POST /api/cameras/:id/stream`

```json
{ "resolution": "sub" }
```

`resolution` is `main`, `sub` or `third`. Defaults to `sub`.

```json
{
  "cameraId": 485618,
  "playUrl": "https://srs-2.turingvideo.com/live/.../....m3u8",
  "resolution": "sub",
  "issuedAt": "2026-09-21T00:37:32.604Z",
  "startWithinSeconds": 600
}
```

## Stream behaviour

Established by testing against a live camera:

- The URL must be opened within roughly 10 minutes of being issued.
- Once playback starts it continues well past that window. Verified over an
  hour of continuous streaming.
- A URL stops working once playback ends, so it cannot be stored and reused.
  This is why a fresh one is issued per request and nothing is cached.
- Several viewers can share one URL concurrently.
- Turing's media host sends permissive CORS headers, so the browser plays the
  stream directly with hls.js. No video proxying needed.

## Deployment

Any host that runs Node. HTTPS is required — MyGeotab is served over HTTPS and
blocks mixed content.

```bash
docker build -t turing-backend .
docker run -p 3000:3000 --env-file .env turing-backend
```

For production set `NODE_ENV=production` and `CORS_ORIGINS` to the Add-In's
host, keep `.env` out of version control, and terminate TLS at a reverse proxy
or a platform that handles it.

## Not included yet

No database. The camera list comes live from Turing, so there is nothing to
persist. One becomes worthwhile when custom camera names, ordering, site
grouping, map positions or per-user access rules are wanted — at which point it
slots in as another service module.

## Known untested

Session verification has not been run against a live MyGeotab instance. It
follows the documented pattern, but that is the first thing to confirm when
wiring the Add-In up.
