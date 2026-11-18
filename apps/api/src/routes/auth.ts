import { Router } from "express";
import { AUTH_COOKIE, authCookieOptions, signToken } from "../auth/token.js";
import { requireAuth } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { loginSchema } from "../schemas/auth.js";
import { validate } from "../schemas/validate.js";
import { authenticate, getCurrentUser } from "../services/auth.js";

export const authRouter = Router();

// Created once, so its counters are shared across requests.
const limitFailedLogins = loginLimiter();

authRouter.post("/login", limitFailedLogins, async (req, res) => {
  const { email, password } = validate(loginSchema, req.body);
  const user = await authenticate(email, password);
  res.cookie(AUTH_COOKIE, signToken({ id: user.id, role: user.role }), authCookieOptions);
  res.json({ user });
});

authRouter.post("/logout", (_req, res) => {
  // clearCookie must use the same options (minus maxAge) as when it was set.
  const { maxAge: _maxAge, ...options } = authCookieOptions;
  res.clearCookie(AUTH_COOKIE, options);
  res.status(204).end();
});

/** Who is logged in. The front end calls this to restore a session on page load. */
authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: await getCurrentUser(req.user!.id) });
});
