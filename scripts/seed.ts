// Inserts sample organizers and events. Safe to run again: fixed ids, so PutItem overwrites the same rows.
//   Locally:  DYNAMODB_ENDPOINT=http://localhost:8000 pnpm seed
//   In AWS:   the manual "seed" workflow (.github/workflows/seed.yml) sets the table names from Pulumi outputs.
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { EventSchema, OrganizerSchema, type Event, type Organizer } from "@ticketlite/shared";
import { ddb } from "./dynamodb-client";

const EVENTS_TABLE = process.env.EVENTS_TABLE ?? "Events";
const ORGANIZERS_TABLE = process.env.ORGANIZERS_TABLE ?? "Organizers";

// Step 1: three organizers. Many events share one organizer, which is what makes N+1 visible in GraphQL.
const organizers: Organizer[] = [
  { organizerId: "org-1", name: "Live Nation India" },
  { organizerId: "org-2", name: "BookMyStage" },
  { organizerId: "org-3", name: "Indie Collective" },
];

// Step 2: events across four cities, one of them a DRAFT (it must never show up publicly).
const now = new Date().toISOString();
const base = { description: "", price: 0, totalSeats: 100, version: 1, createdAt: now, updatedAt: now };
const rows: Array<
  Pick<Event, "eventId" | "name" | "city" | "venue" | "startsAt" | "organizerId" | "status"> & Partial<Event>
> = [
  {
    eventId: "evt-001",
    name: "Coldplay Live",
    city: "Mumbai",
    venue: "DY Patil Stadium",
    startsAt: "2027-01-18T19:00:00.000Z",
    organizerId: "org-1",
    status: "PUBLISHED",
    price: 4999,
    totalSeats: 500,
  },
  {
    eventId: "evt-002",
    name: "Tech Conf India",
    city: "Bengaluru",
    venue: "KTPO",
    startsAt: "2027-01-20T09:00:00.000Z",
    organizerId: "org-2",
    status: "PUBLISHED",
    price: 1999,
  },
  {
    eventId: "evt-003",
    name: "Comedy Night",
    city: "Pune",
    venue: "Hard Rock Cafe",
    startsAt: "2027-02-14T19:30:00.000Z",
    organizerId: "org-3",
    status: "PUBLISHED",
    price: 499,
  },
  {
    eventId: "evt-004",
    name: "Jazz by the Lake",
    city: "Pune",
    venue: "Pashan Lake Amphitheatre",
    startsAt: "2027-02-21T18:00:00.000Z",
    organizerId: "org-3",
    status: "PUBLISHED",
    price: 799,
  },
  {
    eventId: "evt-005",
    name: "Startup Pitch Day",
    city: "Bengaluru",
    venue: "NIMHANS Convention Centre",
    startsAt: "2027-03-02T10:00:00.000Z",
    organizerId: "org-2",
    status: "PUBLISHED",
    price: 0,
  },
  {
    eventId: "evt-006",
    name: "Sufi Evening",
    city: "Delhi",
    venue: "Purana Qila",
    startsAt: "2027-03-08T19:00:00.000Z",
    organizerId: "org-1",
    status: "PUBLISHED",
    price: 1299,
  },
  {
    eventId: "evt-007",
    name: "Marathi Natak",
    city: "Pune",
    venue: "Bal Gandharva Rang Mandir",
    startsAt: "2027-03-15T17:00:00.000Z",
    organizerId: "org-3",
    status: "PUBLISHED",
    price: 350,
  },
  {
    eventId: "evt-008",
    name: "Indie Rock Fest",
    city: "Mumbai",
    venue: "Mahalaxmi Lawns",
    startsAt: "2027-03-22T16:00:00.000Z",
    organizerId: "org-1",
    status: "PUBLISHED",
    price: 2499,
    totalSeats: 300,
  },
  {
    eventId: "evt-009",
    name: "AI Meetup",
    city: "Delhi",
    venue: "India Habitat Centre",
    startsAt: "2027-04-05T18:30:00.000Z",
    organizerId: "org-2",
    status: "PUBLISHED",
    price: 0,
    totalSeats: 60,
  },
  {
    eventId: "evt-010",
    name: "Secret Gig (draft)",
    city: "Pune",
    venue: "TBA",
    startsAt: "2027-04-12T20:00:00.000Z",
    organizerId: "org-3",
    status: "DRAFT",
    price: 999,
  },
];

// Step 3: validate with the same schema the API uses (a typo here fails loudly), then write.
for (const organizer of organizers) {
  await ddb.send(new PutCommand({ TableName: ORGANIZERS_TABLE, Item: OrganizerSchema.parse(organizer) }));
}
for (const row of rows) {
  const event = EventSchema.parse({
    ...base,
    ...row,
    availableSeats: row.totalSeats ?? base.totalSeats,
    description: `${row.name} at ${row.venue}.`,
  });
  await ddb.send(new PutCommand({ TableName: EVENTS_TABLE, Item: event }));
}
console.log(`seeded ${organizers.length} organizers and ${rows.length} events`);
