import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { LoginPage } from "./LoginPage";

vi.mock("../components/SEOHead", () => ({
  SEOHead: () => null,
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    login: vi.fn(),
    register: vi.fn(),
  }),
}));

vi.mock("../lib/api", () => ({
  api: {
    getAuthConfig: vi.fn(),
  },
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.mocked(api.getAuthConfig).mockResolvedValue({
      registrationMode: "ftn-open",
      registrationOpen: true,
      ftnEnabled: true,
    });
  });

  it("renders login and FTN registration actions when registration is open", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: "signIn" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "registerWithBankAuth" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("comingSoon.title")).not.toBeInTheDocument();
  });
});
