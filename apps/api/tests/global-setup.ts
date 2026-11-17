import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { TEST_DATABASE_URL } from "../vitest.config.js";

// Runs once before all tests: start from an empty test.db with the schema applied.
export default function setup() {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    rmSync(`test.db${suffix}`, { force: true });
  }
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "ignore",
  });
}
