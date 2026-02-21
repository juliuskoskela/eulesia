import { randomBytes, createHash } from "crypto";
import argon2 from "argon2";

export function generateToken(length = 32): string {
  return randomBytes(length).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function generateSessionToken(): { token: string; hash: string } {
  const token = generateToken(32);
  const hash = hashToken(token);
  return { token, hash };
}

export function generateMagicLinkToken(): { token: string; hash: string } {
  const token = generateToken(48);
  const hash = hashToken(token);
  return { token, hash };
}
