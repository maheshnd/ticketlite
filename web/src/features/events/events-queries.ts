// React Query hooks for events. CONCEPT: react-query
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { eventKeys } from "../../lib/query-keys";
import { fetchEvent, fetchEvents } from "./events-api";

// Options objects (not just hooks) so the same definition serves useQuery, prefetchQuery and tests.
export const eventListOptions = (city: string | undefined) =>
  infiniteQueryOptions({
    queryKey: eventKeys.list(city),
    queryFn: ({ pageParam }) => fetchEvents(city, pageParam),
    initialPageParam: undefined as string | undefined,
    // The API's cursor IS the next page param. null -> undefined tells React Query "no more pages".
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const eventDetailOptions = (eventId: string) =>
  queryOptions({ queryKey: eventKeys.detail(eventId), queryFn: () => fetchEvent(eventId) });

// Infinite list: pages are appended as the user scrolls. CONCEPT: pagination
export const useEventList = (city: string | undefined) => useInfiniteQuery(eventListOptions(city));

export const useEvent = (eventId: string) =>
  useQuery({ ...eventDetailOptions(eventId), enabled: eventId !== "" });

// Prefetch on hover/focus: by the time the user clicks, the detail is usually already cached.
// CONCEPT: prefetching
export function usePrefetchEvent() {
  const queryClient = useQueryClient();
  return (eventId: string) => void queryClient.prefetchQuery(eventDetailOptions(eventId));
}
