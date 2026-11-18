import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Runs before the imports below, so the app is built with a low login limit.
vi.hoisted(() => {
  process.env.LOGIN_RATE_LIMIT = "3";
});

import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db/client.js";
import { createUser, PASSWORD, resetDb } from "./helpers.js";

beforeAll(async () => {
  await resetDb();
  await createUser("target@test.com", "CUSTOMER");
  await createUser("other@test.com", "CUSTOMER");
});

afterAll(() => prisma.$disconnect());

const login = (email: string, password: string) =>
  request(app).post("/auth/login").send({ email, password });

describe("login rate limit", () => {
  it("doesn't count successful logins", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await login("other@test.com", PASSWORD)).status).toBe(200);
    }
  });

  it("blocks an email after 3 failed logins, even with the right password", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await login("target@test.com", "wrong")).status).toBe(401);
    }

    const blocked = await login("target@test.com", PASSWORD);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("counts emails case-insensitively", async () => {
    expect((await login("  TARGET@test.com ", PASSWORD)).status).toBe(429);
  });

  it("doesn't block other accounts", async () => {
    expect((await login("other@test.com", PASSWORD)).status).toBe(200);
  });
});
