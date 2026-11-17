import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/db/client.js";

const PASSWORD = "Correct-horse-1";

beforeAll(async () => {
  const passwordHash = await hash(PASSWORD, 10);
  await prisma.user.deleteMany();
  await prisma.user.createMany({
    data: [
      { email: "admin@test.com", passwordHash, role: "ADMIN" },
      { email: "customer@test.com", passwordHash, role: "CUSTOMER" },
    ],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

function login(email: string, password: string) {
  return request(app).post("/auth/login").send({ email, password });
}

function tokenCookie(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  const cookie = cookies.find((c) => c.startsWith("token="));
  if (!cookie) throw new Error("No token cookie set");
  return cookie;
}

describe("POST /auth/login", () => {
  it("logs a customer in and sets an httpOnly cookie", async () => {
    const res = await login("customer@test.com", PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: "customer@test.com", role: "CUSTOMER" });
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookie = tokenCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("logs an admin in", async () => {
    const res = await login("admin@test.com", PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("ADMIN");
  });

  it("ignores case and spaces in the email", async () => {
    const res = await login("  Customer@Test.com ", PASSWORD);
    expect(res.status).toBe(200);
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    const wrongPassword = await login("customer@test.com", "wrong");
    const unknownEmail = await login("nobody@test.com", PASSWORD);

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects missing or invalid input with 400", async () => {
    for (const body of [{}, { email: "not-an-email", password: "x" }, { email: "a@b.com" }]) {
      const res = await request(app).post("/auth/login").send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("GET /auth/me", () => {
  it("returns the logged-in user", async () => {
    const cookie = tokenCookie(await login("admin@test.com", PASSWORD));
    const res = await request(app).get("/auth/me").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: "admin@test.com", role: "ADMIN" });
  });

  it("returns 401 when not logged in", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("clears the cookie", async () => {
    const res = await request(app).post("/auth/logout");
    expect(res.status).toBe(204);
    const cleared = tokenCookie(res);
    expect(cleared).toMatch(/^token=;/);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
