// Poster upload: the browser asks the API for a presigned POST, then uploads straight to S3.
// The limits here are ALSO written into the presigned POST's conditions, so S3 itself enforces them.
// CONCEPT: presigned-urls
import { z } from "zod";

export const POSTER_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const PosterContentTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);

export const PosterUploadInputSchema = z.object({
  eventId: z.string().min(1).max(64),
  contentType: PosterContentTypeSchema,
});
export type PosterUploadInput = z.infer<typeof PosterUploadInputSchema>;

// `url` + `fields` become a multipart form POST to S3. `key` is where the file will land.
export const PosterUploadResponseSchema = z.object({
  url: z.string(),
  fields: z.record(z.string(), z.string()),
  key: z.string(),
});
export type PosterUploadResponse = z.infer<typeof PosterUploadResponseSchema>;
