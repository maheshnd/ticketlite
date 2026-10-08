// LoginForm: accessible validation errors, server errors announced, token kept in memory on success.
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getAccessToken } from "../../lib/token-store";
import { renderWithProviders } from "../../test/render";
import { LoginForm } from "./LoginForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("LoginForm", () => {
  it("marks empty fields invalid, links the message, and focuses the first one", async () => {
    renderWithProviders(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Enter a valid email address");
    expect(email).toHaveFocus();
  });

  it("announces a wrong password with role=alert", async () => {
    renderWithProviders(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "test@ticketlite.dev");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong email or password");
    expect(getAccessToken()).toBeNull();
  });

  it("keeps the access token in memory and goes home on success", async () => {
    renderWithProviders(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "test@ticketlite.dev");
    await userEvent.type(screen.getByLabelText("Password"), "Tickets2026x");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getAccessToken()).toBe("mock-access-token");
    expect(window.localStorage.length).toBe(0); // never persisted
  });
});
