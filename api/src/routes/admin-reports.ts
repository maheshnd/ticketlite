// GET /api/admin/reports: SQL aggregations (admins only; 404 when SQL reporting is switched off).
import { ReportsResponseSchema } from "@ticketlite/shared";
import { requireAdmin } from "../plugins/auth-context";
import { getReports } from "../services/reports-service";
import type { App } from "../types";

export function adminReportRoutes(app: App) {
  app.get(
    "/admin/reports",
    { preHandler: requireAdmin, schema: { response: { 200: ReportsResponseSchema } } },
    async (_request, reply) => {
      reply.header("cache-control", "private, no-store");
      return getReports();
    },
  );
}
