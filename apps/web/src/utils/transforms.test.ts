import { describe, it, expect } from "vitest";
import {
  transformAuthor,
  transformComment,
  getAvatarInitials,
} from "./transforms";
import type { AuthorSummary } from "../types/generated/AuthorSummary";
import type { Comment } from "../lib/api";

describe("getAvatarInitials", () => {
  it("returns first two initials uppercased", () => {
    expect(getAvatarInitials("Maria Virtanen")).toBe("MV");
  });

  it("handles single name", () => {
    expect(getAvatarInitials("Admin")).toBe("A");
  });

  it("handles three or more names, takes first two", () => {
    expect(getAvatarInitials("Anna Maria Virtanen")).toBe("AM");
  });

  it("handles lowercase names", () => {
    expect(getAvatarInitials("john doe")).toBe("JD");
  });

  it("handles empty string", () => {
    expect(getAvatarInitials("")).toBe("");
  });
});

describe("transformAuthor", () => {
  const mockAuthor: AuthorSummary = {
    id: "user-1",
    username: "mvirtanen",
    name: "Maria Virtanen",
    role: "citizen",
    avatarUrl: "https://example.com/avatar.jpg",
  };

  it("transforms a citizen author correctly", () => {
    const result = transformAuthor(mockAuthor);
    expect(result.id).toBe("user-1");
    expect(result.name).toBe("Maria Virtanen");
    expect(result.role).toBe("citizen");
    expect(result.canViewProfile).toBe(true);
    expect(result.avatarInitials).toBe("MV");
    expect(result.avatarUrl).toBe("https://example.com/avatar.jpg");
  });

  it("computes avatarInitials from name", () => {
    const result = transformAuthor({
      ...mockAuthor,
      name: "City of Helsinki",
    });
    expect(result.avatarInitials).toBe("CO");
  });

  it("accepts a minimal {id, name, role} object", () => {
    const result = transformAuthor({
      id: "op-1",
      name: "Eulesia Operator",
      role: "citizen",
    });
    expect(result.id).toBe("op-1");
    expect(result.avatarInitials).toBe("EO");
    expect(result.avatarUrl).toBeNull();
  });

  it("canViewProfile is false for empty id", () => {
    const result = transformAuthor({ id: "", name: "Test", role: "citizen" });
    expect(result.canViewProfile).toBe(false);
  });
});

describe("transformComment", () => {
  it("prefers the top-level authorId when the public author summary is scrubbed", () => {
    const result = transformComment({
      id: "comment-1",
      threadId: "thread-1",
      authorId: "user-1",
      content: "Managed operator comment",
      score: 0,
      depth: 0,
      author: {
        id: "",
        name: "Eulesia Operator",
        role: "citizen",
      },
      createdAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    } as Comment);

    expect(result.authorId).toBe("user-1");
  });
});
