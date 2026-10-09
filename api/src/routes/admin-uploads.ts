// POST /api/admin/uploads/poster: returns a presigned POST. The browser then uploads the file straight to S3.
// CONCEPT: presigned-urls
import { PosterUploadInputSchema, PosterUploadResponseSchema } from "@ticketlite/shared";
import { requireAdmin } from "../plugins/auth-context";
import { createPosterUpload } from "../services/posters-service";
import type { App } from "../types";

export function adminUploadRoutes(app: App) {
  app.post(
    "/admin/uploads/poster",
    {
      preHandler: requireAdmin,
      schema: { body: PosterUploadInputSchema, response: { 200: PosterUploadResponseSchema } },
    },
    async (request) => createPosterUpload(request.body),
  );
}
