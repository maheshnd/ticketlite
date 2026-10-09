// Converts between an Event and the event form's string fields. Inputs always hold strings; the API wants
// numbers and full ISO 8601 dates.
import type { Event } from "@ticketlite/shared";

// <input type="datetime-local"> wants "2027-02-14T19:30"; the API wants full ISO 8601 in UTC.
const toLocalInput = (iso: string) => iso.slice(0, 16);
const toIso = (local: string) => (local ? new Date(`${local}:00Z`).toISOString() : "");

// The form's starting values: the event being edited, or blanks for a new one.
export const initialValues = (event?: Event): Record<string, string> => ({
  name: event?.name ?? "",
  description: event?.description ?? "",
  city: event?.city ?? "",
  venue: event?.venue ?? "",
  startsAt: event ? toLocalInput(event.startsAt) : "",
  price: String(event?.price ?? ""),
  totalSeats: String(event?.totalSeats ?? ""),
  organizerId: event?.organizerId ?? "org-1",
  status: event?.status ?? "DRAFT",
});

// Strings -> API types, before the shared Zod schema validates them. "" becomes undefined, so the schema
// reports the field as missing instead of "not a number".
export const toApiInput = (values: Record<string, string>) => ({
  ...values,
  price: values.price === "" ? undefined : Number(values.price),
  totalSeats: values.totalSeats === "" ? undefined : Number(values.totalSeats),
  startsAt: toIso(values.startsAt ?? ""),
});
