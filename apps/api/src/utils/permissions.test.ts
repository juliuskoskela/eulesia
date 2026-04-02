import { describe, it, expect } from "vitest";
import { isBotContent, canEdit, canDelete } from "./permissions.js";

const citizen = { id: "user-1", role: "citizen" as const };
const otherCitizen = { id: "user-2", role: "citizen" as const };
const institution = { id: "inst-1", role: "institution" as const };

const userContent = {
  authorId: "user-1",
  source: "user" as const,
  aiGenerated: false,
};
const botContent = {
  authorId: "bot-1",
  source: "minutes_import" as const,
  aiGenerated: false,
};
const aiContent = { authorId: "bot-1", source: null, aiGenerated: true };

describe("isBotContent", () => {
  it("returns true for minutes_import source", () => {
    expect(isBotContent(botContent)).toBe(true);
  });

  it("returns true for AI generated content", () => {
    expect(isBotContent(aiContent)).toBe(true);
  });

  it("returns false for user-created content", () => {
    expect(isBotContent(userContent)).toBe(false);
  });

  it("returns false for null/undefined source without aiGenerated", () => {
    expect(
      isBotContent({ authorId: "x", source: null, aiGenerated: false }),
    ).toBe(false);
    expect(
      isBotContent({ authorId: "x", source: null, aiGenerated: null }),
    ).toBe(false);
  });
});

describe("canEdit", () => {
  it("allows authors to edit their own content", () => {
    expect(canEdit(citizen, userContent)).toBe(true);
  });

  it("denies non-authors from editing user content", () => {
    expect(canEdit(otherCitizen, userContent)).toBe(false);
  });

  it("allows any user to edit bot content", () => {
    expect(canEdit(citizen, botContent)).toBe(true);
    expect(canEdit(otherCitizen, botContent)).toBe(true);
    expect(canEdit(institution, botContent)).toBe(true);
  });

  it("allows any user to edit AI generated content", () => {
    expect(canEdit(citizen, aiContent)).toBe(true);
  });
});

describe("canDelete", () => {
  it("allows authors to delete their own content", () => {
    expect(canDelete(citizen, userContent)).toBe(true);
  });

  it("denies non-authors from deleting user content", () => {
    expect(canDelete(otherCitizen, userContent)).toBe(false);
  });

  it("denies deletion of bot content by non-admins", () => {
    expect(canDelete(citizen, botContent)).toBe(false);
    expect(canDelete(otherCitizen, botContent)).toBe(false);
  });
});
