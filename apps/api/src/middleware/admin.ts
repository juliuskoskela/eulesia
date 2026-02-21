import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: "Not authenticated" });
    return;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({ success: false, error: "Admin access required" });
    return;
  }

  next();
}
