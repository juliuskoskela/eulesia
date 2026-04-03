import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ScopeBadge } from "./ScopeBadge";

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("ScopeBadge", () => {
  it("renders local scope with default label", () => {
    renderWithRouter(<ScopeBadge scope="local" />);

    expect(screen.getByText("Paikallinen")).toBeInTheDocument();
  });

  it("renders national scope", () => {
    renderWithRouter(<ScopeBadge scope="national" />);

    expect(screen.getByText("Valtakunnallinen")).toBeInTheDocument();
  });

  it("renders european scope", () => {
    renderWithRouter(<ScopeBadge scope="european" />);

    expect(screen.getByText("EU")).toBeInTheDocument();
  });

  it("displays municipality name when provided", () => {
    renderWithRouter(<ScopeBadge scope="local" municipalityName="Helsinki" />);

    expect(screen.getByText("Helsinki")).toBeInTheDocument();
    expect(screen.queryByText("Paikallinen")).not.toBeInTheDocument();
  });

  it("renders the icon", () => {
    const { container } = renderWithRouter(<ScopeBadge scope="local" />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders as a link when municipalityId is provided", () => {
    renderWithRouter(
      <ScopeBadge
        scope="local"
        municipalityId="rautalampi"
        municipalityName="Rautalampi"
      />,
    );

    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/kunnat/rautalampi");
  });

  it("renders as span without municipalityId", () => {
    const { container } = renderWithRouter(<ScopeBadge scope="local" />);

    const link = container.querySelector("a");
    expect(link).not.toBeInTheDocument();
  });
});
