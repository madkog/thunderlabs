import jwt from "jsonwebtoken";
import type { CookieOptions } from "express";
import { Role } from "../../generated/prisma/enums.js";

export type AuthUser = { id: number; role: Role };

export const AUTH_COOKIE = "token";

const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

// httpOnly keeps the token away from page JavaScript (XSS can't read it).
export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: TOKEN_TTL_SECONDS * 1000,
  path: "/",
};

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not set. Copy .env.example to .env.");
  return value;
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ role: user.role }, secret(), {
    algorithm: "HS256",
    subject: String(user.id),
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

/** Returns the user in the token. Throws if it is invalid, expired or malformed. */
export function verifyToken(token: string): AuthUser {
  // Pinning the algorithm rejects "alg: none" and algorithm-swap tokens.
  const payload = jwt.verify(token, secret(), { algorithms: ["HS256"] });
  if (typeof payload === "string") throw new Error("Unexpected token payload");

  const id = Number(payload.sub);
  const role = payload.role;
  if (!Number.isInteger(id) || !Object.values(Role).includes(role)) {
    throw new Error("Malformed token payload");
  }
  return { id, role };
}
