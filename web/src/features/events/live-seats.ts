"use client";
// Live seat count: subscribes to onSeatUpdate for one event and writes each update straight into the React
// Query cache, so the detail page re-renders with the new number. No refetch needed. CONCEPT: real-time
import type { Event } from "@ticketlite/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { graphql } from "../../gql";
import { appsyncEnabled } from "../../lib/appsync";
import { subscribe } from "../../lib/appsync-realtime";
import { eventKeys } from "../../lib/query-keys";

export const OnSeatUpdate = graphql(`
  subscription OnSeatUpdate($eventId: ID!) {
    onSeatUpdate(eventId: $eventId) {
      eventId
      availableSeats
      updatedAt
    }
  }
`);

export function useLiveSeats(eventId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!appsyncEnabled || !eventId) return;
    // setQueryData: update the cached event in place. CONCEPT: react-query
    return subscribe(OnSeatUpdate, { eventId }, (data) => {
      const update = data.onSeatUpdate;
      if (!update) return;
      queryClient.setQueryData<Event>(eventKeys.detail(eventId), (event) =>
        event ? { ...event, availableSeats: update.availableSeats } : event,
      );
    });
  }, [eventId, queryClient]);
}
