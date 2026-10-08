// React Query hooks for bookings. CONCEPT: react-query
import {
  isFinalStatus,
  type Booking,
  type BookingPage,
  type CreateBookingInput,
  type CreateBookingResponse,
} from "@ticketlite/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api-client";
import { bookingKeys, eventKeys } from "../../lib/query-keys";

// POST with an Idempotency-Key. The caller passes the SAME key when it retries the same click, so a
// network blip can never create two bookings. CONCEPT: idempotency
export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateBookingInput; idempotencyKey: string }) =>
      apiFetch<CreateBookingResponse>("/api/bookings", {
        method: "POST",
        body: input,
        headers: { "idempotency-key": idempotencyKey },
      }),
    // Cache invalidation: "my bookings" is now out of date. CONCEPT: cache-invalidation
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookingKeys.mine() }),
  });
}

// Polls every second while the saga is running, and stops by itself once the status is final.
// CONCEPT: polling
export function useBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: async () => {
      const booking = await apiFetch<Booking>(`/api/bookings/${encodeURIComponent(bookingId)}`);
      // The seat count changed: the event page must not show the old number.
      if (isFinalStatus(booking.status))
        void queryClient.invalidateQueries({ queryKey: eventKeys.detail(booking.eventId) });
      return booking;
    },
    enabled: bookingId !== "",
    refetchInterval: (query) => (query.state.data && isFinalStatus(query.state.data.status) ? false : 1000),
  });
}

export function useMyBookings() {
  return useInfiniteQuery({
    queryKey: bookingKeys.mine(),
    queryFn: ({ pageParam }) =>
      apiFetch<BookingPage>(
        `/api/bookings?limit=10${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
