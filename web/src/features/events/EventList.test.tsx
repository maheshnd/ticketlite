// EventList: loads the first page, loads more on demand, filters by city.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { EventList } from "./EventList";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("EventList", () => {
  it("shows the first page of events, then the next page after 'Load more'", async () => {
    renderWithProviders(<EventList />);

    const list = await screen.findByRole("list", { name: "Events" });
    expect(await within(list).findAllByRole("listitem")).toHaveLength(12);

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(await within(list).findByText("Event 15")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("filters events by city", async () => {
    renderWithProviders(<EventList />);
    await screen.findByText("Event 2");

    await userEvent.type(screen.getByLabelText("City"), "Mumbai");
    await userEvent.click(screen.getByRole("button", { name: "Filter" }));

    expect(await screen.findByText("Event 2")).toBeInTheDocument(); // events 2, 5, 8, ... are in Mumbai
    expect(screen.queryByText("Event 1")).not.toBeInTheDocument();
  });
});
