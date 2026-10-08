// Admin event routes. Every route checks the "admin" group from the token. CONCEPT: rbac
//   GET  /api/admin/events      -> all events incl. drafts
//   GET  /api/admin/events/:id  -> one event, strongly consistent (the edit form needs the latest version)
//   POST /api/admin/events      -> 201 Created + Location
//   PUT  /api/admin/events/:id  -> 200, or 409 if the version is stale (optimistic locking)
import { CreateEventInputSchema, EventSchema, UpdateEventInputSchema } from "@ticketlite/shared";
import { z } from "zod";
import { requireAdmin } from "../plugins/auth-context";
import { createEvent, getEventForEdit, listAllEvents, updateEvent } from "../services/admin-events-service";
import type { App } from "../types";

const IdParams = z.object({ id: z.string().min(1).max(64) });

export function adminEventRoutes(app: App) {
  app.get(
    "/admin/events",
    { preHandler: requireAdmin, schema: { response: { 200: z.object({ items: z.array(EventSchema) }) } } },
    async (_request, reply) => {
      reply.header("cache-control", "private, no-store");
      return { items: await listAllEvents() };
    },
  );

  app.get(
    "/admin/events/:id",
    { preHandler: requireAdmin, schema: { params: IdParams, response: { 200: EventSchema } } },
    async (request, reply) => {
      reply.header("cache-control", "private, no-store");
      return getEventForEdit(request.params.id);
    },
  );

  app.post(
    "/admin/events",
    { preHandler: requireAdmin, schema: { body: CreateEventInputSchema, response: { 201: EventSchema } } },
    async (request, reply) => {
      const event = await createEvent(request.body);
      reply.header("location", `/api/events/${event.eventId}`);
      return reply.code(201).send(event);
    },
  );

  app.put(
    "/admin/events/:id",
    {
      preHandler: requireAdmin,
      schema: { params: IdParams, body: UpdateEventInputSchema, response: { 200: EventSchema } },
    },
    async (request) => updateEvent(request.params.id, request.body),
  );
}
