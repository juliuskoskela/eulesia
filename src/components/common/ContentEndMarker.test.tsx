import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContentEndMarker } from "./ContentEndMarker";

describe("ContentEndMarker", () => {
  it("renders with default message", () => {
    render(<ContentEndMarker />);

    expect(screen.getByText("You're up to date")).toBeInTheDocument();
    expect(screen.getByText("No more content to show")).toBeInTheDocument();
  });

  it("renders with custom message", () => {
    render(<ContentEndMarker message="End of discussion" />);

    expect(screen.getByText("End of discussion")).toBeInTheDocument();
  });

  it("renders checkmark icon", () => {
    const { container } = render(<ContentEndMarker />);

    // The CheckCircle2 icon should be present
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
