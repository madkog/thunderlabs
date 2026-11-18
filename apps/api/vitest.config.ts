import { defineConfig } from "vitest/config";

export const TEST_DATABASE_URL = "file:./test.db";

export default defineConfig({
  test: {
    // Tests use their own database, so they never touch dev.db.
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: "test-secret",
      NODE_ENV: "test",
      // Tests log in many times. The rate-limit tests set their own low limits.
      LOGIN_RATE_LIMIT: "100000",
      API_RATE_LIMIT: "100000",
    },
    globalSetup: ["tests/global-setup.ts"],
    // One SQLite file is shared, so run test files one at a time.
    fileParallelism: false,
  },
});
