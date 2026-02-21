import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThreadVoteButtons } from "./ThreadVoteButtons";

// Mock useAuth
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: { id: "user-1", name: "Test", role: "citizen" },
  }),
}));

describe("ThreadVoteButtons", () => {
  it("displays the score", () => {
    render(
      <ThreadVoteButtons
        threadId="t1"
        score={42}
        userVote={0}
        onVote={vi.fn()}
      />,
    );

    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("formats large scores with k suffix", () => {
    render(
      <ThreadVoteButtons
        threadId="t1"
        score={1200}
        userVote={0}
        onVote={vi.fn()}
      />,
    );

    expect(screen.getByText("1.2k")).toBeInTheDocument();
  });

  it("formats 1000 as 1k", () => {
    render(
      <ThreadVoteButtons
        threadId="t1"
        score={1000}
        userVote={0}
        onVote={vi.fn()}
      />,
    );

    expect(screen.getByText("1k")).toBeInTheDocument();
  });

  it("calls onVote with 1 when upvoting (no current vote)", () => {
    const onVote = vi.fn();
    render(
      <ThreadVoteButtons
        threadId="t1"
        score={10}
        userVote={0}
        onVote={onVote}
      />,
    );

    const upvoteBtn = screen.getByLabelText("actions.upvote");
    fireEvent.click(upvoteBtn);

    expect(onVote).toHaveBeenCalledWith(1);
  });

  it("calls onVote with 0 when removing upvote", () => {
    const onVote = vi.fn();
    render(
      <ThreadVoteButtons
        threadId="t1"
        score={10}
        userVote={1}
        onVote={onVote}
      />,
    );

    const upvoteBtn = screen.getByLabelText("actions.upvote");
    fireEvent.click(upvoteBtn);

    expect(onVote).toHaveBeenCalledWith(0);
  });

  it("calls onVote with -1 when downvoting", () => {
    const onVote = vi.fn();
    render(
      <ThreadVoteButtons
        threadId="t1"
        score={10}
        userVote={0}
        onVote={onVote}
      />,
    );

    const downvoteBtn = screen.getByLabelText("actions.downvote");
    fireEvent.click(downvoteBtn);

    expect(onVote).toHaveBeenCalledWith(-1);
  });

  it("calls onVote with 0 when removing downvote", () => {
    const onVote = vi.fn();
    render(
      <ThreadVoteButtons
        threadId="t1"
        score={10}
        userVote={-1}
        onVote={onVote}
      />,
    );

    const downvoteBtn = screen.getByLabelText("actions.downvote");
    fireEvent.click(downvoteBtn);

    expect(onVote).toHaveBeenCalledWith(0);
  });

  it("does not call onVote when loading", () => {
    const onVote = vi.fn();
    render(
      <ThreadVoteButtons
        threadId="t1"
        score={10}
        userVote={0}
        onVote={onVote}
        isLoading={true}
      />,
    );

    const upvoteBtn = screen.getByLabelText("actions.upvote");
    fireEvent.click(upvoteBtn);

    expect(onVote).not.toHaveBeenCalled();
  });

  it("shows upvote as pressed when userVote is 1", () => {
    render(
      <ThreadVoteButtons
        threadId="t1"
        score={10}
        userVote={1}
        onVote={vi.fn()}
      />,
    );

    const upvoteBtn = screen.getByLabelText("actions.upvote");
    expect(upvoteBtn).toHaveAttribute("aria-pressed", "true");
  });
});
