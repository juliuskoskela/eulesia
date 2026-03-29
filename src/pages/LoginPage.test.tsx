import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";
import { api } from "../lib/api";

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
    vi.clearAllMocks();
    vi.mocked(api.getAuthConfig).mockResolvedValue({
      registrationMode: "ftn-open",
      registrationOpen: true,
      ftnEnabled: true,
    });
  });

  it("renders the FTN registration handoff on the dedicated register route", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/register?ftn=test-token&firstName=Jane&lastName=Doe",
        ]}
      >
        <LoginPage />
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("Jane")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Doe")).toBeInTheDocument();
    expect(screen.getByText("ftn.verified")).toBeInTheDocument();
  });
});
