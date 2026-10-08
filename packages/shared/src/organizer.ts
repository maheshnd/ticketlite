// An Organizer runs events. A small seeded list, mostly used to show the GraphQL N+1 problem (M4).
import { z } from "zod";

export const OrganizerSchema = z.object({
  organizerId: z.string().min(1),
  name: z.string().min(1),
});
export type Organizer = z.infer<typeof OrganizerSchema>;
