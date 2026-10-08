// AdminEventList: the publish toggle updates instantly (optimistic) and rolls back if the server refuses.
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, delay, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../mocks/server";
import { renderWithProviders } from "../../test/render";
import { AdminEventList } from "./AdminEventList";

describe("AdminEventList", () => {
  it("flips the status before the server answers (optimistic update)", async () => {
    server.use(
      http.put("*/api/admin/events/:id", async () => {
        await delay("infinite"); // the server never answers during this test
        return HttpResponse.json({});
      }),
    );
    renderWithProviders(<AdminEventList />);
    await userEvent.click(await screen.findByRole("button", { name: "Unpublish Event 1" }));
    expect(await screen.findByRole("button", { name: "Publish Event 1" })).toHaveTextContent("DRAFT");
  });

  it("rolls back and explains when the version is stale (409)", async () => {
    server.use(
      http.put("*/api/admin/events/:id", () =>
        HttpResponse.json(
          { title: "Conflict", status: 409, detail: "Someone else changed this event." },
          { status: 409 },
        ),
      ),
    );
    renderWithProviders(<AdminEventList />);
    await userEvent.click(await screen.findByRole("button", { name: "Unpublish Event 1" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Someone else changed this event.");
    expect(screen.getByRole("button", { name: "Unpublish Event 1" })).toHaveTextContent("PUBLISHED");
  });
});
