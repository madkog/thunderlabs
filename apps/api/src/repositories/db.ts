import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../db/client.js";

/**
 * The database handle a repository function runs on: the shared client, or a
 * transaction. Repository functions default to the shared client, and services
 * pass a transaction when several steps must succeed or fail together.
 */
export type Db = typeof prisma | Prisma.TransactionClient;

export { prisma };

/** Runs fn in one database transaction. If it throws, every write in it is undone. */
export function inTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}
