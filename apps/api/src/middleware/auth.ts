import type { RequestHandler } from "express";
import type { Role } from "../../generated/prisma/enums.js";
import { AUTH_COOKIE, verifyToken } from "../auth/token.js";
import { AppError } from "../errors.js";

/** Rejects the request with 401 unless it has a valid login cookie, then sets req.user. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== "string" || token === "") {
    throw new AppError(401, "UNAUTHENTICATED", "Log in to continue.");
  }

  try {
    req.user = verifyToken(token);
  } catch {
    throw new AppError(401, "UNAUTHENTICATED", "Your session is invalid or has expired. Log in again.");
  }
  next();
};

/** Use after requireAuth. Rejects with 403 unless the user has one of the given roles. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, "FORBIDDEN", "You don't have permission to do this.");
    }
    next();
  };
}
