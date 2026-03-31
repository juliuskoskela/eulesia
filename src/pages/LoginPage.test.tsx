import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
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
  it("renders the coming soon message when registration is closed", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("comingSoon.title")).toBeInTheDocument();
    expect(screen.getByText("comingSoon.description")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "signIn" }),
    ).not.toBeInTheDocument();
  });
});
