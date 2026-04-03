import { describe, it, expect } from "vitest";
import { sanitizeContent } from "./sanitize";

describe("sanitizeContent", () => {
  it("allows basic HTML tags", () => {
    const html = "<p>Hello <strong>world</strong></p>";
    expect(sanitizeContent(html)).toBe(html);
  });

  it("strips script tags", () => {
    const html = '<p>Safe</p><script>alert("xss")</script>';
    expect(sanitizeContent(html)).toBe("<p>Safe</p>");
  });

  it("strips onclick handlers", () => {
    const html = '<button onclick="alert(1)">Click</button>';
    const result = sanitizeContent(html);
    expect(result).not.toContain("onclick");
  });

  it("allows YouTube iframes", () => {
    const html =
      '<iframe src="https://www.youtube-nocookie.com/embed/abc123"></iframe>';
    const result = sanitizeContent(html);
    expect(result).toContain("iframe");
    expect(result).toContain("youtube-nocookie.com");
  });

  it("removes non-YouTube iframes", () => {
    const html = '<iframe src="https://evil.com/malware"></iframe>';
    const result = sanitizeContent(html);
    expect(result).not.toContain("iframe");
    expect(result).not.toContain("evil.com");
  });

  it("allows data-url attribute", () => {
    const html = '<div data-url="https://example.com">Preview</div>';
    const result = sanitizeContent(html);
    expect(result).toContain("data-url");
  });

  it("strips javascript: URLs", () => {
    const html = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeContent(html);
    expect(result).not.toContain("javascript:");
  });

  it("handles empty input", () => {
    expect(sanitizeContent("")).toBe("");
  });

  it("preserves allowed attributes on iframes", () => {
    const html =
      '<iframe src="https://www.youtube.com/embed/test" allow="autoplay" allowfullscreen loading="lazy"></iframe>';
    const result = sanitizeContent(html);
    expect(result).toContain("allow=");
    expect(result).toContain("allowfullscreen");
    expect(result).toContain("loading=");
  });
});
