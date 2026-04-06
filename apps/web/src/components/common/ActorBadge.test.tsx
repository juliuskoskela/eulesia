import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ActorBadge } from "./ActorBadge";

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

const mockCitizen = {
  id: "1",
  name: "Maria Virtanen",
  role: "citizen",
  avatarInitials: "MV",
  verified: true,
};

const mockInstitution = {
  id: "2",
  name: "City of Helsinki",
  role: "institution",
  avatarInitials: "CH",
  institutionType: "municipality",
  verified: true,
};

describe("ActorBadge", () => {
  it("renders citizen user with name", () => {
    renderWithRouter(<ActorBadge user={mockCitizen} />);

    expect(screen.getByText("Maria Virtanen")).toBeInTheDocument();
    expect(screen.getByText("MV")).toBeInTheDocument();
  });

  it("renders institution user with Official badge", () => {
    renderWithRouter(<ActorBadge user={mockInstitution} />);

    expect(screen.getByText("City of Helsinki")).toBeInTheDocument();
    expect(screen.getByText("Official")).toBeInTheDocument();
  });

  it("shows institution type for institutional users", () => {
    renderWithRouter(<ActorBadge user={mockInstitution} />);

    expect(screen.getByText("municipality")).toBeInTheDocument();
  });

  it("hides name when showName is false", () => {
    renderWithRouter(<ActorBadge user={mockCitizen} showName={false} />);

    expect(screen.queryByText("Maria Virtanen")).not.toBeInTheDocument();
    expect(screen.getByText("MV")).toBeInTheDocument();
  });

  it("renders different sizes", () => {
    const { container, rerender } = renderWithRouter(
      <ActorBadge user={mockCitizen} size="sm" />,
    );

    let avatar = container.querySelector(".w-6");
    expect(avatar).toBeInTheDocument();

    rerender(
      <BrowserRouter>
        <ActorBadge user={mockCitizen} size="lg" />
      </BrowserRouter>,
    );
    avatar = container.querySelector(".w-10");
    expect(avatar).toBeInTheDocument();
  });

  it("does not render a profile link when the user has no public id", () => {
    renderWithRouter(
      <ActorBadge
        user={{
          ...mockCitizen,
          id: null,
          name: "Eulesia Operator",
        }}
      />,
    );

    expect(screen.getByText("Eulesia Operator")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not render a profile link when the profile is intentionally hidden", () => {
    renderWithRouter(
      <ActorBadge
        user={{
          ...mockCitizen,
          canViewProfile: false,
        }}
      />,
    );

    expect(screen.getByText("Maria Virtanen")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
