import { Router } from "express";
import { compare } from "bcryptjs";
import { prisma } from "../db/client.js";
import { AUTH_COOKIE, authCookieOptions, signToken } from "../auth/token.js";
import { AppError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { loginSchema } from "../schemas/auth.js";
import { validate } from "../schemas/validate.js";

export const authRouter = Router();

// Compared against when the email doesn't exist, so a wrong email takes as
// long as a wrong password and response times don't reveal which emails exist.
const DUMMY_HASH = "$2b$10$aDjsrZV4nTehISxjVeEtb.81cWY9DuLWSwUIfsEEpG1.iZfMrJCou";

// Created once, so its counters are shared across requests.
const limitFailedLogins = loginLimiter();

authRouter.post("/login", limitFailedLogins, async (req, res) => {
  const { email, password } = validate(loginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await compare(password, user?.passwordHash ?? DUMMY_HASH);

  // Same response for an unknown email and a wrong password.
  if (!user || !passwordOk) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  res.cookie(AUTH_COOKIE, signToken({ id: user.id, role: user.role }), authCookieOptions);
  res.json({ user: { id: user.id, email: user.email, role: user.role } });
});

authRouter.post("/logout", (_req, res) => {
  // clearCookie must use the same options (minus maxAge) as when it was set.
  const { maxAge: _maxAge, ...options } = authCookieOptions;
  res.clearCookie(AUTH_COOKIE, options);
  res.status(204).end();
});

/** Who is logged in. The front end calls this to restore a session on page load. */
authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    // The token is valid but the account has been deleted.
    throw new AppError(401, "UNAUTHENTICATED", "Log in to continue.");
  }
  res.json({ user });
});
