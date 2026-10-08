import type { FastifyInstance } from "fastify";

// GET /health: the cheapest possible "is the app alive?" check.
// It touches no database, so it answers even when other parts are broken.
export function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return { status: "ok" };
  });
}
