// React Query hooks for the admin pages. CONCEPT: react-query, optimistic-update
import type { CreateEventInput, Event, PosterUploadResponse, UpdateEventInput } from "@ticketlite/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api-client";
import { adminKeys, eventKeys } from "../../lib/query-keys";

export const useAdminEvents = () =>
  useQuery({
    queryKey: adminKeys.events(),
    queryFn: async () => (await apiFetch<{ items: Event[] }>("/api/admin/events")).items,
  });

// staleTime 0: the edit form must start from the newest version, or the first save fails with 409.
export const useAdminEvent = (eventId: string) =>
  useQuery({
    queryKey: adminKeys.event(eventId),
    queryFn: () => apiFetch<Event>(`/api/admin/events/${encodeURIComponent(eventId)}`),
    enabled: eventId !== "",
    staleTime: 0,
  });

// After any admin write, every cached event list or detail may be wrong: invalidate them all.
// CONCEPT: cache-invalidation
function useInvalidateEvents() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.all }),
      queryClient.invalidateQueries({ queryKey: eventKeys.all }),
    ]);
}

export function useCreateEvent() {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: (input: CreateEventInput) =>
      apiFetch<Event>("/api/admin/events", { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateEvent(eventId: string) {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: (input: UpdateEventInput) =>
      apiFetch<Event>(`/api/admin/events/${encodeURIComponent(eventId)}`, { method: "PUT", body: input }),
    onSuccess: invalidate,
  });
}

// Publish / unpublish with an OPTIMISTIC update: the list changes instantly, before the server answers.
//   onMutate: snapshot the cache, then write the new status into it
//   onError:  put the snapshot back (rollback), e.g. on a 409 version conflict
//   onSettled: refetch either way, so the cache ends up matching the server
export function useToggleStatus() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: (event: Event) =>
      apiFetch<Event>(`/api/admin/events/${encodeURIComponent(event.eventId)}`, {
        method: "PUT",
        body: { status: event.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED", version: event.version },
      }),
    onMutate: async (event) => {
      await queryClient.cancelQueries({ queryKey: adminKeys.events() }); // don't let an in-flight fetch overwrite us
      const previous = queryClient.getQueryData<Event[]>(adminKeys.events());
      queryClient.setQueryData<Event[]>(adminKeys.events(), (events) =>
        events?.map((e) =>
          e.eventId === event.eventId
            ? { ...e, status: e.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }
            : e,
        ),
      );
      return { previous };
    },
    onError: (_error, _event, context) => queryClient.setQueryData(adminKeys.events(), context?.previous),
    onSettled: invalidate,
  });
}

// Step 1: ask the API for a presigned POST. Step 2: POST the file straight to S3 as multipart form data.
// The policy fields MUST come before the file in the form, or S3 rejects the upload.
export function useUploadPoster() {
  return useMutation({
    mutationFn: async ({ eventId, file }: { eventId: string; file: File }) => {
      const presigned = await apiFetch<PosterUploadResponse>("/api/admin/uploads/poster", {
        method: "POST",
        body: { eventId, contentType: file.type },
      });
      const form = new FormData();
      for (const [name, value] of Object.entries(presigned.fields)) form.append(name, value);
      form.append("file", file);
      const response = await fetch(presigned.url, { method: "POST", body: form });
      if (!response.ok)
        throw new Error(`Upload rejected by S3 (${response.status}). Max 2 MB, JPEG/PNG/WebP only.`);
      return presigned.key;
    },
  });
}
