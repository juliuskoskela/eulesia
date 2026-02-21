import { describe, it, expect } from "vitest";
import {
  generateToken,
  hashToken,
  generateSessionToken,
  generateMagicLinkToken,
} from "./crypto.js";

describe("generateToken", () => {
  it("generates a base64url-encoded token", () => {
    const token = generateToken();
    expect(token).toBeTruthy();
    // base64url charset: A-Z, a-z, 0-9, -, _
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates tokens of different lengths", () => {
    const short = generateToken(16);
    const long = generateToken(64);
    // base64url encoding: 4 chars per 3 bytes
    expect(short.length).toBeLessThan(long.length);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateToken()));
    expect(tokens.size).toBe(10);
  });
});

describe("hashToken", () => {
  it("returns a hex SHA256 hash", () => {
    const hash = hashToken("test-token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces deterministic output", () => {
    const hash1 = hashToken("same-input");
    const hash2 = hashToken("same-input");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", () => {
    const hash1 = hashToken("input-a");
    const hash2 = hashToken("input-b");
    expect(hash1).not.toBe(hash2);
  });
});

describe("generateSessionToken", () => {
  it("returns a token and its hash", () => {
    const { token, hash } = generateSessionToken();
    expect(token).toBeTruthy();
    expect(hash).toBeTruthy();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hash matches the token", () => {
    const { token, hash } = generateSessionToken();
    expect(hashToken(token)).toBe(hash);
  });
});

describe("generateMagicLinkToken", () => {
  it("returns a token and its hash", () => {
    const { token, hash } = generateMagicLinkToken();
    expect(token).toBeTruthy();
    expect(hash).toBeTruthy();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates longer tokens than session tokens", () => {
    const session = generateSessionToken();
    const magic = generateMagicLinkToken();
    // 48 bytes vs 32 bytes → magic link token is longer
    expect(magic.token.length).toBeGreaterThan(session.token.length);
  });

  it("hash matches the token", () => {
    const { token, hash } = generateMagicLinkToken();
    expect(hashToken(token)).toBe(hash);
  });
});
