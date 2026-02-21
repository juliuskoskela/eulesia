import type { Request } from "express";
import { env } from "./env.js";

function isCapacitorOrigin(req?: Request): boolean {
  if (!req) return false;
  const origin = req.headers?.origin || "";
  return origin.includes("capacitor://") || origin === "https://localhost";
}

export function getSessionCookieOptions(req?: Request) {
  const capacitor = isCapacitorOrigin(req);
  return {
    httpOnly: true,
    secure: capacitor || env.NODE_ENV === "production",
    sameSite: capacitor ? ("none" as const) : ("lax" as const),
    domain: capacitor ? undefined : env.COOKIE_DOMAIN,
    path: "/",
  };
}
