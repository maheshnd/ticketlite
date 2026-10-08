// BookButton: login link for visitors; for users, a booking with an Idempotency-Key, then the status page.
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../../lib/token-store";
import { mockEvents } from "../../mocks/data";
import { server } from "../../mocks/server";
import { renderWithProviders } from "../../test/render";
import { BookButton } from "./BookButton";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const event = mockEvents[0]!;

describe("BookButton", () => {
  it("asks visitors to log in", async () => {
    renderWithProviders(<BookButton event={event} />);
    expect(await screen.findByRole("link", { name: "Log in to book" })).toHaveAttribute("href", "/login");
  });

  it("books with an Idempotency-Key and opens the booking status page", async () => {
    setAccessToken("token");
    let sentKey: string | null = null;
    server.use(
      http.post("*/api/bookings", ({ request }) => {
        sentKey = request.headers.get("idempotency-key");
        return HttpResponse.json({ bookingId: "bk-42", status: "PENDING" }, { status: 202 });
      }),
    );
    renderWithProviders(<BookButton event={event} />);

    await userEvent.selectOptions(screen.getByLabelText("Seats"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Book" }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/booking?id=bk-42"));
    expect(sentKey).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("shows the API's message when the booking is refused", async () => {
    setAccessToken("token");
    server.use(
      http.post("*/api/bookings", () =>
        HttpResponse.json({ title: "Conflict", status: 409, detail: "Only 1 seats left." }, { status: 409 }),
      ),
    );
    renderWithProviders(<BookButton event={event} />);
    await userEvent.click(await screen.findByRole("button", { name: "Book" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only 1 seats left.");
  });
});
