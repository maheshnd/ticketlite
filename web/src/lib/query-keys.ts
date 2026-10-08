// Query key factory: every React Query key in the app comes from here, so invalidating "all event
// lists" or "this one event" is one call and can't be misspelled. CONCEPT: query-key-factory
export const eventKeys = {
  all: ["events"] as const,
  lists: () => [...eventKeys.all, "list"] as const,
  list: (city: string | undefined) => [...eventKeys.lists(), { city: city ?? null }] as const,
  details: () => [...eventKeys.all, "detail"] as const,
  detail: (eventId: string) => [...eventKeys.details(), eventId] as const,
};

export const bookingKeys = {
  all: ["bookings"] as const,
  mine: () => [...bookingKeys.all, "mine"] as const,
  detail: (bookingId: string) => [...bookingKeys.all, "detail", bookingId] as const,
};

export const adminKeys = {
  all: ["admin"] as const,
  events: () => [...adminKeys.all, "events"] as const,
  event: (eventId: string) => [...adminKeys.events(), eventId] as const,
};

export const searchKeys = {
  all: ["search"] as const,
  query: (q: string, city: string | undefined) => [...searchKeys.all, { q, city: city ?? null }] as const,
};

export const authKeys = {
  me: ["me"] as const,
};
