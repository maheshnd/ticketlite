"use client";
// Create or edit an event. On edit, the form remembers the `version` it loaded; if someone else saved in
// between, the API answers 409 and we offer to reload their changes. CONCEPT: optimistic-locking
import { CreateEventInputSchema, type CreateEventInput, type Event } from "@ticketlite/shared";
import { useRouter } from "next/navigation";
import { FormAlert } from "../../components/FormAlert";
import { TextField } from "../../components/TextField";
import { ApiError } from "../../lib/api-client";
import { useForm } from "../auth/use-form";
import { useCreateEvent, useUpdateEvent } from "./admin-queries";

// <input type="datetime-local"> wants "2027-02-14T19:30"; the API wants full ISO 8601 in UTC.
const toLocalInput = (iso: string) => iso.slice(0, 16);
const toIso = (local: string) => (local ? new Date(`${local}:00Z`).toISOString() : "");

export function EventForm({ event, onConflict }: { event?: Event; onConflict?: () => void }) {
  const router = useRouter();
  const create = useCreateEvent();
  const update = useUpdateEvent(event?.eventId ?? "");

  const form = useForm<CreateEventInput>(
    CreateEventInputSchema,
    {
      name: event?.name ?? "",
      description: event?.description ?? "",
      city: event?.city ?? "",
      venue: event?.venue ?? "",
      startsAt: event ? toLocalInput(event.startsAt) : "",
      price: String(event?.price ?? ""),
      totalSeats: String(event?.totalSeats ?? ""),
      organizerId: event?.organizerId ?? "org-1",
      status: event?.status ?? "DRAFT",
    },
    async (data) => {
      if (event) await update.mutateAsync({ ...data, version: event.version });
      else await create.mutateAsync(data);
      router.push("/admin/events");
    },
    // The inputs hold strings; the API wants numbers and an ISO date. "" stays "" so the schema reports it.
    (v) => ({
      ...v,
      price: v.price === "" ? undefined : Number(v.price),
      totalSeats: v.totalSeats === "" ? undefined : Number(v.totalSeats),
      startsAt: toIso(v.startsAt ?? ""),
    }),
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
      <TextField
        id="name"
        label="Name"
        value={form.values.name!}
        error={form.errors.name}
        onChange={form.setValue("name")}
      />
      <TextField
        id="description"
        label="Description"
        value={form.values.description!}
        error={form.errors.description}
        onChange={form.setValue("description")}
      />
      <TextField
        id="city"
        label="City"
        value={form.values.city!}
        error={form.errors.city}
        onChange={form.setValue("city")}
      />
      <TextField
        id="venue"
        label="Venue"
        value={form.values.venue!}
        error={form.errors.venue}
        onChange={form.setValue("venue")}
      />
      <TextField
        id="startsAt"
        label="Starts at (UTC)"
        type="datetime-local"
        value={form.values.startsAt!}
        error={form.errors.startsAt}
        onChange={form.setValue("startsAt")}
      />
      <TextField
        id="price"
        label="Price (INR)"
        type="number"
        value={form.values.price!}
        error={form.errors.price}
        onChange={form.setValue("price")}
      />
      <TextField
        id="totalSeats"
        label="Total seats"
        type="number"
        value={form.values.totalSeats!}
        error={form.errors.totalSeats}
        onChange={form.setValue("totalSeats")}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="status">Status</label>
        <select
          id="status"
          value={form.values.status}
          onChange={(e) => form.setValue("status")(e.target.value)}
          className="rounded border border-slate-400 p-2"
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={form.submitting}
        className="self-start rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {event ? "Save changes" : "Create event"}
      </button>
    </form>
  );
}
