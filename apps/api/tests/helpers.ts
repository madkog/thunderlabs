import { hashSync } from "bcryptjs";
import request from "supertest";
import type { Role } from "../generated/prisma/enums.js";
import { app } from "../src/app.js";
import { prisma } from "../src/db/client.js";

export const PASSWORD = "Correct-horse-1";
// Cost 4 keeps tests fast. Production code uses 10.
const passwordHash = hashSync(PASSWORD, 4);

/** Empties every table, children first so foreign keys are satisfied. */
export async function resetDb() {
  await prisma.stockMovement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
}

export function createUser(email: string, role: Role) {
  return prisma.user.create({ data: { email, passwordHash, role } });
}

export function createProduct(data: { name: string; priceCents: number; unitsInStock: number }) {
  return prisma.product.create({ data });
}

/** Logs in through the real endpoint and returns the Cookie header to send. */
export async function loginCookie(email: string): Promise<string> {
  const res = await request(app).post("/auth/login").send({ email, password: PASSWORD });
  const cookie = ([] as string[]).concat(res.headers["set-cookie"] ?? []).find((c) => c.startsWith("token="));
  if (!cookie) throw new Error(`Login failed for ${email}: ${res.status}`);
  return cookie.split(";")[0];
}
