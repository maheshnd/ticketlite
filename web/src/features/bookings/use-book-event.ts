// Books seats for one event, safely retryable. CONCEPT: idempotency
// One Idempotency-Key per booking ATTEMPT: generated on the first click, reused if the user clicks again
// after a failure (so a request that actually reached the server isn't booked twice), and replaced after
// a success (the next booking is a new attempt).
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useCreateBooking } from "./bookings-queries";

export function useBookEvent(eventId: string) {
  const router = useRouter();
  const createBooking = useCreateBooking();
  const idempotencyKey = useRef<string | null>(null);

  function book(seats: number) {
    idempotencyKey.current ??= crypto.randomUUID();
    createBooking.mutate(
      { input: { eventId, seats }, idempotencyKey: idempotencyKey.current },
      {
        onSuccess: ({ bookingId }) => {
          idempotencyKey.current = null;
          router.push(`/booking?id=${encodeURIComponent(bookingId)}`);
        },
      },
    );
  }

  return { book, isPending: createBooking.isPending, error: createBooking.error };
}
