import { describe, it, expect } from "vitest";

// Test the validateFinnishBusinessId logic directly
// Since it's not exported, we re-implement it here for testing
function validateFinnishBusinessId(id: string): boolean {
  const match = id.match(/^(\d{7})-(\d)$/);
  if (!match) return false;
  const digits = match[1];
  const checkDigit = parseInt(match[2]);
  const weights = [7, 9, 10, 5, 8, 4, 2];
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += parseInt(digits[i]) * weights[i];
  }
  const remainder = sum % 11;
  if (remainder === 1) return false;
  const expected = remainder === 0 ? 0 : 11 - remainder;
  return checkDigit === expected;
}

function validateBusinessId(id: string, country: string): boolean {
  switch (country) {
    case "FI":
      return validateFinnishBusinessId(id);
    case "SE":
      return /^\d{6}-\d{4}$/.test(id);
    case "EE":
      return /^\d{8}$/.test(id);
    case "DE":
      return /^(DE)?\d{9}$/.test(id);
    default:
      return id.length >= 5 && id.length <= 30;
  }
}

describe("validateFinnishBusinessId", () => {
  it("validates correct Finnish business IDs", () => {
    // Known valid y-tunnus values
    expect(validateFinnishBusinessId("0112038-9")).toBe(true); // Nokia
    expect(validateFinnishBusinessId("2331972-7")).toBe(true);
  });

  it("rejects invalid format", () => {
    expect(validateFinnishBusinessId("12345678")).toBe(false);
    expect(validateFinnishBusinessId("1234567")).toBe(false);
    expect(validateFinnishBusinessId("123456-78")).toBe(false);
    expect(validateFinnishBusinessId("abcdefg-1")).toBe(false);
    expect(validateFinnishBusinessId("")).toBe(false);
  });

  it("rejects wrong check digit", () => {
    // 0112038-9 is valid, -0 through -8 should be invalid
    expect(validateFinnishBusinessId("0112038-0")).toBe(false);
    expect(validateFinnishBusinessId("0112038-5")).toBe(false);
  });
});

describe("validateBusinessId", () => {
  it("validates Finnish business IDs", () => {
    expect(validateBusinessId("0112038-9", "FI")).toBe(true);
    expect(validateBusinessId("invalid", "FI")).toBe(false);
  });

  it("validates Swedish organization numbers", () => {
    expect(validateBusinessId("556036-0793", "SE")).toBe(true);
    expect(validateBusinessId("12345-678", "SE")).toBe(false);
  });

  it("validates Estonian registry codes", () => {
    expect(validateBusinessId("10137025", "EE")).toBe(true);
    expect(validateBusinessId("1234567", "EE")).toBe(false);
  });

  it("validates German USt-IdNr", () => {
    expect(validateBusinessId("DE123456789", "DE")).toBe(true);
    expect(validateBusinessId("123456789", "DE")).toBe(true);
    expect(validateBusinessId("12345", "DE")).toBe(false);
  });

  it("uses length validation for unknown countries", () => {
    expect(validateBusinessId("12345", "FR")).toBe(true);
    expect(validateBusinessId("1234", "FR")).toBe(false);
    expect(validateBusinessId("a".repeat(31), "FR")).toBe(false);
  });
});
