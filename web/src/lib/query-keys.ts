// Query key factory: every React Query key in the app comes from here, so invalidating "all event
// lists" or "this one event" is one call and can't be misspelled. CONCEPT: query-key-factory
export const eventKeys = {
  all: ["events"] as const,
  lists: () => [...eventKeys.all, "list"] as const,
  list: (city: string | undefined) => [...eventKeys.lists(), { city: city ?? null }] as const,
  details: () => [...eventKeys.all, "detail"] as const,
  detail: (eventId: string) => [...eventKeys.details(), eventId] as const,
};

export const authKeys = {
  me: ["me"] as const,
};
