import { prisma } from "./db.js";

/** Includes the password hash, for checking a login. Never send it to a client. */
export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

/** Only the fields that are safe to send to a client. */
export function findUserById(id: number) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true },
  });
}
