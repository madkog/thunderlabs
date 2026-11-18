import { ipKeyGenerator, rateLimit, type Options } from "express-rate-limit";
import { AppError } from "../errors.js";

const MINUTE = 60 * 1000;

function limitFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

// Pass a 429 to the error handler, so it has the same shape as every other error.
const rateLimited: Options["handler"] = (_req, _res, next, options) => {
  next(
    new AppError(429, "RATE_LIMITED", "Too many requests. Try again later.", {
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    }),
  );
};

/**
 * Failed logins per email address (and IP), to slow down password guessing.
 * Successful logins don't count, so a real user is never locked out by their own logins.
 *
 * Keyed by email as well as IP because, behind the Next.js /api proxy, every
 * browser reaches the API from the same address. Per-IP only would let one
 * attacker lock everyone out.
 */
export function loginLimiter() {
  return rateLimit({
    windowMs: 15 * MINUTE,
    limit: limitFromEnv("LOGIN_RATE_LIMIT", 5),
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      return `${ipKeyGenerator(req.ip ?? "")}:${email}`;
    },
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: rateLimited,
  });
}

/** A generous overall cap per IP, against scripts hammering the API. */
export function apiLimiter() {
  return rateLimit({
    windowMs: MINUTE,
    limit: limitFromEnv("API_RATE_LIMIT", 300),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: rateLimited,
  });
}
