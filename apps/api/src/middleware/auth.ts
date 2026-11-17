import type { RequestHandler } from "express";
import type { Role } from "../../generated/prisma/enums.js";
import { AUTH_COOKIE, verifyToken } from "../auth/token.js";

/** Rejects the request with 401 unless it has a valid login cookie, then sets req.user. */
export const requireAuth: RequestHandler = (req, res, next) => {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== "string" || token === "") {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Log in to continue." } });
    return;
  }

  try {
    req.user = verifyToken(token);
  } catch {
    res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Your session is invalid or has expired. Log in again." },
    });
    return;
  }
  next();
};

/** Use after requireAuth. Rejects with 403 unless the user has one of the given roles. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        error: { code: "FORBIDDEN", message: "You don't have permission to do this." },
      });
      return;
    }
    next();
  };
}
