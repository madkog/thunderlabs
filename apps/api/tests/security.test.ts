import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("security headers", () => {
  it("sets helmet's headers and hides the framework", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("request bodies", () => {
  it("rejects a body over 10kb with 413", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "a@b.com", password: "x".repeat(11_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejects invalid JSON with 400", async () => {
    const res = await request(app).post("/auth/login").set("Content-Type", "application/json").send("{bad");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("ignores a body that isn't JSON (e.g. a cross-site form post)", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "text/plain")
      .send('{"email":"a@b.com","password":"x"}');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("unknown routes", () => {
  it("return 404 in the standard error shape", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
