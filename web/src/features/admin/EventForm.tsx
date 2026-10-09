"use client";
// Create or edit an event. On edit, the form remembers the `version` it loaded; if someone else saved in
// between, the API answers 409 and we offer to reload their changes. CONCEPT: optimistic-locking
import { CreateEventInputSchema, type CreateEventInput, type Event } from "@ticketlite/shared";
import { useRouter } from "next/navigation";
import { FormAlert } from "../../components/FormAlert";
import { SubmitButton } from "../../components/SubmitButton";
import { ApiError } from "../../lib/api-client";
import { useForm } from "../auth/use-form";
import { useCreateEvent, useUpdateEvent } from "./admin-queries";
import { EventFields } from "./EventFields";
import { initialValues, toApiInput } from "./event-form-values";

export function EventForm({ event, onConflict }: { event?: Event; onConflict?: () => void }) {
  const router = useRouter();
  const create = useCreateEvent();
  const update = useUpdateEvent(event?.eventId ?? "");

  // Edit sends the version it started from; create needs none.
  const form = useForm<CreateEventInput>(
    CreateEventInputSchema,
    initialValues(event),
    async (data) => {
      if (event) await update.mutateAsync({ ...data, version: event.version });
      else await create.mutateAsync(data);
      router.push("/admin/events");
    },
    toApiInput,
  );

  const conflict = update.error instanceof ApiError && update.error.status === 409;
  return (
    <form noValidate onSubmit={form.onSubmit} className="flex max-w-lg flex-col gap-4">
      <FormAlert message={form.formError} />
      {conflict && onConflict && (
        <button
          type="button"
          onClick={onConflict}
          className="self-start rounded border border-indigo-700 px-3 py-1 text-indigo-700"
        >
          Reload the latest version
        </button>
      )}
      <EventFields values={form.values} errors={form.errors} setValue={form.setValue} />
      <SubmitButton submitting={form.submitting} className="self-start">
        {event ? "Save changes" : "Create event"}
      </SubmitButton>
    </form>
  );
}
