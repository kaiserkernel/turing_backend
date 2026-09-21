import { Router } from "express";

export const healthRouter = Router();

/** Unauthenticated, for uptime checks and load balancers. */
healthRouter.get("/", (req, res) => {
  res.json({
    ok: true,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});
