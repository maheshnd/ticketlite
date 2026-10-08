// GET /api/admin/reports response (only when the optional SQL reporting is on).
import { z } from "zod";

export const ReportsResponseSchema = z.object({
  revenuePerEvent: z.array(
    z.object({ eventId: z.string(), name: z.string(), bookings: z.number(), revenue: z.number() }),
  ),
  bookingsPerDay: z.array(z.object({ day: z.string(), bookings: z.number() })),
});
export type ReportsResponse = z.infer<typeof ReportsResponseSchema>;
