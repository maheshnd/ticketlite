// GET /api/health: the cheapest possible "is the app alive?" check.
// It touches no database, so it answers even when other parts are broken.
// CloudFront smoke tests and uptime checks call it after every deploy.
import { z } from "zod";
import { config } from "../config";
import type { App } from "../types";

const HealthResponse = z.object({ status: z.literal("ok"), stage: z.string() });

export function healthRoutes(app: App) {
  app.get("/health", { schema: { response: { 200: HealthResponse } } }, async () => {
    return { status: "ok" as const, stage: config.stage };
  });
}
