// SearchPage: debounced typing fires one search; city buttons filter; the fallback is announced.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { mockEvents } from "../../mocks/data";
import { server } from "../../mocks/server";
import { renderWithProviders } from "../../test/render";
import { SearchPage } from "./SearchPage";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("SearchPage", () => {
  it("sends ONE request after the user stops typing", async () => {
    let calls = 0;
    server.use(
      http.get("*/api/search", () => {
        calls++;
        return HttpResponse.json({
          items: [mockEvents[0]],
          total: 1,
          cities: [{ city: "Pune", count: 1 }],
          source: "opensearch",
        });
      }),
    );
    renderWithProviders(<SearchPage />);
    await userEvent.type(screen.getByLabelText("Search events"), "event 1");
    expect(await screen.findByText("1 result")).toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it("filters by a city from the aggregation and says when the fallback answered", async () => {
    renderWithProviders(<SearchPage />);
    await userEvent.type(screen.getByLabelText("Search events"), "event");
    const filters = await screen.findByRole("group", { name: "Filter by city" });
    expect(screen.getByText(/OpenSearch is switched off/)).toBeInTheDocument();

    await userEvent.click(within(filters).getByRole("button", { name: /^Mumbai/ }));
    expect(await screen.findByText("5 results")).toBeInTheDocument(); // 15 mock events, every 3rd in Mumbai
    expect(within(filters).getByRole("button", { name: /^Mumbai/ })).toHaveAttribute("aria-pressed", "true");
  });
});
