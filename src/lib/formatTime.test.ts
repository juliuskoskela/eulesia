import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatRelativeTime,
  formatRelativeTimeShort,
  formatMessageDate,
} from "./formatTime";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-17T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for < 60 seconds ago', () => {
    const result = formatRelativeTime("2026-02-17T11:59:30Z");
    expect(result).toContain("justNow");
  });

  it("returns minutes ago for < 60 minutes", () => {
    const result = formatRelativeTime("2026-02-17T11:30:00Z");
    expect(result).toContain("minutesAgo");
  });

  it("returns hours ago for < 24 hours", () => {
    const result = formatRelativeTime("2026-02-17T06:00:00Z");
    expect(result).toContain("hoursAgo");
  });

  it("returns yesterday for 1 day ago", () => {
    const result = formatRelativeTime("2026-02-16T12:00:00Z");
    expect(result).toContain("yesterday");
  });

  it("returns days ago for 2-6 days", () => {
    const result = formatRelativeTime("2026-02-14T12:00:00Z");
    expect(result).toContain("daysAgo");
  });

  it("returns formatted date for > 7 days", () => {
    const result = formatRelativeTime("2026-01-01T12:00:00Z");
    // Should be a formatted date string, not a translation key
    expect(result).not.toContain("daysAgo");
  });
});

describe("formatRelativeTimeShort", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-17T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns short format for just now", () => {
    const result = formatRelativeTimeShort("2026-02-17T11:59:30Z");
    expect(result).toContain("justNowShort");
  });

  it("returns short minutes for < 60 min", () => {
    const result = formatRelativeTimeShort("2026-02-17T11:45:00Z");
    expect(result).toContain("minutesShort");
  });

  it("returns short hours for < 24 hours", () => {
    const result = formatRelativeTimeShort("2026-02-17T06:00:00Z");
    expect(result).toContain("hoursShort");
  });

  it("returns short days for < 30 days", () => {
    const result = formatRelativeTimeShort("2026-02-14T12:00:00Z");
    expect(result).toContain("daysShort");
  });
});

describe("formatMessageDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-17T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns time for today", () => {
    const result = formatMessageDate("2026-02-17T10:30:00Z");
    // Should return a time format like "10:30" or "12:30"
    expect(result).not.toContain("yesterday");
    expect(result).not.toContain("daysAgo");
  });

  it("returns yesterday for 1 day ago", () => {
    const result = formatMessageDate("2026-02-16T12:00:00Z");
    expect(result).toContain("yesterday");
  });

  it("returns days ago for 2-6 days", () => {
    const result = formatMessageDate("2026-02-14T12:00:00Z");
    expect(result).toContain("daysAgo");
  });
});
