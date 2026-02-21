import { describe, it, expect } from "vitest";
import { transformAuthor, getAvatarInitials } from "./transforms";
import type { UserSummary } from "../lib/api";

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
  const mockAuthor: UserSummary = {
    id: "user-1",
    name: "Maria Virtanen",
    role: "citizen",
    identityVerified: true,
    avatarUrl: "https://example.com/avatar.jpg",
    institutionType: undefined,
    institutionName: undefined,
  };

  it("transforms a citizen author correctly", () => {
    const result = transformAuthor(mockAuthor);
    expect(result.id).toBe("user-1");
    expect(result.name).toBe("Maria Virtanen");
    expect(result.role).toBe("citizen");
    expect(result.verified).toBe(true);
    expect(result.avatarInitials).toBe("MV");
    expect(result.avatarUrl).toBe("https://example.com/avatar.jpg");
  });

  it("sets verified to false when identityVerified is null/undefined", () => {
    const result = transformAuthor({
      ...mockAuthor,
      identityVerified: undefined,
    } as unknown as UserSummary);
    expect(result.verified).toBe(false);
  });

  it("transforms an institution author", () => {
    const instAuthor: UserSummary = {
      id: "inst-1",
      name: "City of Helsinki",
      role: "institution",
      identityVerified: true,
      avatarUrl: undefined,
      institutionType: "municipality",
      institutionName: "Helsingin kaupunki",
    };
    const result = transformAuthor(instAuthor);
    expect(result.institutionType).toBe("municipality");
    expect(result.institutionName).toBe("Helsingin kaupunki");
    expect(result.avatarInitials).toBe("CO");
  });
});
