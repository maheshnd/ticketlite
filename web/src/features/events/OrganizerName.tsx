"use client";
// "Organized by …", fetched through AppSync (GraphQL): the REST event detail doesn't include the organizer.
// The query asks for exactly the two fields it needs. CONCEPT: graphql-client
import { useQuery } from "@tanstack/react-query";
import { graphql } from "../../gql";
import { appsyncEnabled, appsyncQuery } from "../../lib/appsync";

const EventOrganizer = graphql(`
  query EventOrganizer($id: ID!) {
    event(id: $id) {
      eventId
      organizer {
        name
      }
    }
  }
`);

export function OrganizerName({ eventId }: { eventId: string }) {
  const { data } = useQuery({
    queryKey: ["graphql", "event-organizer", eventId],
    queryFn: () => appsyncQuery(EventOrganizer, { id: eventId }),
    enabled: appsyncEnabled,
    staleTime: 10 * 60_000, // organizers almost never change
  });
  const name = data?.event?.organizer?.name;
  return name ? <p className="text-slate-700">Organized by {name}</p> : null;
}
