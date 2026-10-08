// EventDetail: the seat count is in a live region; unknown events get a clear message.
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/render";
import { EventDetail } from "./EventDetail";

describe("EventDetail", () => {
  it("announces the seat count in an aria-live region", async () => {
    renderWithProviders(<EventDetail eventId="evt-001" />);
    const seats = await screen.findByText("40 of 100 seats left");
    expect(seats).toHaveAttribute("aria-live", "polite");
  });

  it("says so when the event does not exist", async () => {
    renderWithProviders(<EventDetail eventId="nope" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This event does not exist.");
  });
});
