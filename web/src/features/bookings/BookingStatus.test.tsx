// BookingStatus: polls while PENDING and announces the final status in a live region.
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setAccessToken } from "../../lib/token-store";
import { renderWithProviders } from "../../test/render";
import { BookingStatus } from "./BookingStatus";

describe("BookingStatus", () => {
  it("shows Processing, then Confirmed once polling sees the final status", async () => {
    setAccessToken("token");
    renderWithProviders(<BookingStatus bookingId="bk-poll" />);

    expect(await screen.findByText("Processing your booking…")).toBeInTheDocument();
    // The mock flips to CONFIRMED on the second read; refetchInterval polls every second.
    const status = await screen.findByText("Confirmed! Enjoy the show.", {}, { timeout: 3000 });
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});
