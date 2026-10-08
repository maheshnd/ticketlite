import Fastify from "fastify";
import { healthRoutes } from "./routes/health.js";
import { eventsRoutes } from "./routes/events.js";
import { copyInfoRoutes } from "./routes/copy-info.js";

// Builds the Fastify app but does NOT start a server.
// Two entry points share it: local.ts listens on a port, and lambda.ts hands it to Lambda.
export function buildApp() {
  // logger: true makes Fastify write JSON logs (one JSON object per line).
  // CloudWatch Logs Insights can then query fields like reqId or responseTime.
  const app = Fastify({ logger: true });

  // Each route file registers its own routes. This file only wires them together.
  healthRoutes(app);
  eventsRoutes(app);
  copyInfoRoutes(app);

  return app;
}
