// Cursor pagination shapes shared by every list endpoint.
// The cursor is opaque to clients: they pass back exactly what they got and never build one themselves.
// CONCEPT: pagination
import { z } from "zod";

// Step 1: query string for list endpoints, e.g. ?limit=20&cursor=eyJ...
// z.coerce turns the "20" string from the URL into the number 20.
export const PageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});
export type PageQuery = z.infer<typeof PageQuerySchema>;

// Step 2: every list response looks the same: the items plus the cursor for the next page (if any).
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}
