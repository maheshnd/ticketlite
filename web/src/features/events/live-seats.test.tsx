// Live seat count, end to end in the test: the real WebSocket client talks to MSW's fake AppSync, a seat
// update is pushed, and the number on screen changes without any refetch.
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { pushSeatUpdate } from "../../mocks/handlers";
import { renderWithProviders } from "../../test/render";
import { EventDetail } from "./EventDetail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("live seat count", () => {
  it("updates the seat count when AppSync pushes a SeatUpdate", async () => {
    renderWithProviders(<EventDetail eventId="evt-001" />);
    expect(await screen.findByText("40 of 100 seats left")).toBeInTheDocument();
    expect(await screen.findByText("Organized by Live Nation India")).toBeInTheDocument(); // GraphQL query

    // Wait until the subscription is acknowledged, then push an update for this event.
    await vi.waitFor(() => {
      pushSeatUpdate("evt-001", 37);
      expect(screen.getByText("37 of 100 seats left")).toBeInTheDocument();
    });
  });
});
