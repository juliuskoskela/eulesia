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

  it("shows the FTN-only registration entry point without invite UI", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: "registerWithBankAuth" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("iHaveInvite")).not.toBeInTheDocument();
    expect(screen.getByText("ftn.availabilityNotice")).toBeInTheDocument();
  });

  it("maps the Idura registration limit error to the dedicated retry message", async () => {
    render(
      <MemoryRouter
        initialEntries={["/register?ftn_error=ftn_registration_limit"]}
      >
        <LoginPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("ftn.registrationLimit"),
    ).toBeInTheDocument();
  });
});
