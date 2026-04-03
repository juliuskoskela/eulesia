import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { CookieConsent } from "./CookieConsent";

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("CookieConsent", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not show immediately", () => {
    renderWithRouter(<CookieConsent />);
    expect(screen.queryByText("cookies.accept")).not.toBeInTheDocument();
  });

  it("shows after 1 second delay when no consent stored", async () => {
    renderWithRouter(<CookieConsent />);

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.getByText("cookies.accept")).toBeInTheDocument();
    expect(screen.getByText("cookies.essentialOnly")).toBeInTheDocument();
  });

  it("does not show when consent already stored", async () => {
    localStorage.setItem("eulesia_cookie_consent", "accepted");
    renderWithRouter(<CookieConsent />);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByText("cookies.accept")).not.toBeInTheDocument();
  });

  it('hides and stores "accepted" on accept click', async () => {
    renderWithRouter(<CookieConsent />);

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    const acceptBtn = screen.getByText("cookies.accept");
    await act(async () => {
      acceptBtn.click();
    });

    expect(localStorage.getItem("eulesia_cookie_consent")).toBe("accepted");
    expect(screen.queryByText("cookies.accept")).not.toBeInTheDocument();
  });

  it('hides and stores "essential_only" on reject click', async () => {
    renderWithRouter(<CookieConsent />);

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    const rejectBtn = screen.getByText("cookies.essentialOnly");
    await act(async () => {
      rejectBtn.click();
    });

    expect(localStorage.getItem("eulesia_cookie_consent")).toBe(
      "essential_only",
    );
    expect(screen.queryByText("cookies.essentialOnly")).not.toBeInTheDocument();
  });
});
