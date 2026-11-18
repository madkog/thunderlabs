import { describe, expect, it, vi } from "vitest";

// Runs before the imports below, so the app is built with a low overall limit.
vi.hoisted(() => {
  process.env.API_RATE_LIMIT = "5";
});

import request from "supertest";
import { app } from "../src/app.js";

describe("overall API rate limit", () => {
  it("returns 429 once the limit is used up", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await request(app).get("/health")).status).toBe(200);
    }

    const blocked = await request(app).get("/health");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatchObject({ code: "RATE_LIMITED", details: { retryAfterSeconds: 60 } });
  });
});
