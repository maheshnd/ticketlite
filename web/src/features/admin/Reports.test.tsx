// Reports: shows the SQL aggregates, or explains that the flag is off.
import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../mocks/server";
import { renderWithProviders } from "../../test/render";
import { Reports } from "./Reports";

describe("Reports", () => {
  it("shows revenue per event", async () => {
    renderWithProviders(<Reports />);
    expect(await screen.findByRole("cell", { name: "Event 1" })).toBeInTheDocument();
  });

  it("explains when SQL reporting is switched off (404)", async () => {
    server.use(
      http.get("*/api/admin/reports", () =>
        HttpResponse.json({ title: "Not Found", status: 404, detail: "off" }, { status: 404 }),
      ),
    );
    renderWithProviders(<Reports />);
    expect(await screen.findByText(/SQL reporting is switched off/)).toBeInTheDocument();
  });
});
