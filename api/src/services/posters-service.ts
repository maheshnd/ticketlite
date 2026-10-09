// Poster uploads: check the event exists, pick a key, and presign a POST limited to one image file.
// CONCEPT: presigned-urls
import { randomUUID } from "node:crypto";
import { POSTER_MAX_BYTES, type PosterUploadInput, type PosterUploadResponse } from "@ticketlite/shared";
import { notFound } from "../errors";
import { presignPosterUpload } from "../lib/s3";
import { getEventById } from "../repositories/events-repository";

const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

export async function createPosterUpload(input: PosterUploadInput): Promise<PosterUploadResponse> {
  if (!(await getEventById(input.eventId))) throw notFound(`Event ${input.eventId} does not exist.`);

  // The key is chosen by the SERVER (never by the client), so nobody can overwrite another event's files.
  // poster-processor reads the eventId back from it: posters/<eventId>/<random>.<ext>
  const key = `posters/${input.eventId}/${randomUUID()}.${extension[input.contentType]}`;
  const { url, fields } = await presignPosterUpload(key, input.contentType, POSTER_MAX_BYTES);
  return { url, fields, key };
}
