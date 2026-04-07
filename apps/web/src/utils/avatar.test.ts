import { describe, it, expect } from "vitest";
import { getAvatarInitials } from "./avatar";

describe("getAvatarInitials", () => {
  it("extracts two initials from full name", () => {
    expect(getAvatarInitials("John Doe")).toBe("JD");
  });

  it("handles single name", () => {
    expect(getAvatarInitials("Alice")).toBe("A");
  });

  it("handles three-part name", () => {
    expect(getAvatarInitials("Anna Maria Virtanen")).toBe("AM");
  });

  it("handles empty string", () => {
    expect(getAvatarInitials("")).toBe("");
  });
});
