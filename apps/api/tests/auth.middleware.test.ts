import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AUTH_COOKIE, signToken } from "../src/auth/token.js";
import { requireAuth, requireRole } from "../src/middleware/auth.js";

const SECRET = "test-secret";

// A small app with one route per access level, so these tests need no database.
const app = express();
app.use(cookieParser());
app.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
app.get("/admin", requireAuth, requireRole("ADMIN"), (_req, res) => {
  res.json({ ok: true });
});

const cookie = (token: string) => `${AUTH_COOKIE}=${token}`;
const customer = () => signToken({ id: 2, role: "CUSTOMER" });
const admin = () => signToken({ id: 1, role: "ADMIN" });

beforeAll(() => {
  vi.stubEnv("JWT_SECRET", SECRET);
});

describe("requireAuth", () => {
  it("rejects a request with no cookie", async () => {
    const res = await request(app).get("/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects a token signed with a different secret", async () => {
    const forged = jwt.sign({ role: "ADMIN" }, "wrong-secret", { subject: "1" });
    const res = await request(app).get("/me").set("Cookie", cookie(forged));
    expect(res.status).toBe(401);
  });

  it("rejects a tampered token", async () => {
    const [header, , signature] = customer().split(".");
    const payload = Buffer.from(JSON.stringify({ sub: "2", role: "ADMIN" })).toString("base64url");
    const res = await request(app)
      .get("/admin")
      .set("Cookie", cookie(`${header}.${payload}.${signature}`));
    expect(res.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const expired = jwt.sign({ role: "CUSTOMER", exp: Math.floor(Date.now() / 1000) - 10 }, SECRET, {
      subject: "2",
    });
    const res = await request(app).get("/me").set("Cookie", cookie(expired));
    expect(res.status).toBe(401);
  });

  it('rejects an unsigned "alg: none" token', async () => {
    const unsigned = jwt.sign({ role: "ADMIN" }, "", { algorithm: "none", subject: "1" });
    const res = await request(app).get("/admin").set("Cookie", cookie(unsigned));
    expect(res.status).toBe(401);
  });

  it("rejects a token with an unknown role", async () => {
    const weird = jwt.sign({ role: "SUPERUSER" }, SECRET, { subject: "1" });
    const res = await request(app).get("/me").set("Cookie", cookie(weird));
    expect(res.status).toBe(401);
  });

  it("lets a signed-in customer through and sets req.user", async () => {
    const res = await request(app).get("/me").set("Cookie", cookie(customer()));
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 2, role: "CUSTOMER" });
  });
});

describe("requireRole", () => {
  it("rejects a customer on an admin route with 403", async () => {
    const res = await request(app).get("/admin").set("Cookie", cookie(customer()));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("lets an admin through", async () => {
    const res = await request(app).get("/admin").set("Cookie", cookie(admin()));
    expect(res.status).toBe(200);
  });
});
