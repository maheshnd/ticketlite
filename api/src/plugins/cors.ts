// CORS for LOCAL development only. Locally the web app (localhost:3001) and the API (localhost:3000)
// are different origins, so the browser needs CORS headers. In the cloud, CloudFront serves both from
// one origin, so this plugin is not registered at all. CONCEPT: cors, same-origin
import cors from "@fastify/cors";
import { config } from "../config";
import type { App } from "../types";

export async function registerLocalCors(app: App) {
  if (!config.isLocal) return;

  await app.register(cors, {
    origin: config.localWebOrigin, // exactly one origin, never "*"
    credentials: true, // allow the refresh-token cookie to be sent
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: [
      "content-type",
      "authorization",
      "idempotency-key",
      "x-csrf",
      "x-correlation-id",
      "if-none-match",
    ],
    exposedHeaders: ["x-correlation-id", "etag", "retry-after"], // headers the web app may read
  });
}
