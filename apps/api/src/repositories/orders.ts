import type { Prisma } from "../../generated/prisma/client.js";
import { prisma, type Db } from "./db.js";

const orderInclude = {
  items: {
    select: {
      productId: true,
      quantity: true,
      unitPriceCents: true,
      product: { select: { name: true } },
    },
  },
} as const;

export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/**
 * Saves an order with its lines, and one ORDER stock movement per line, in a
 * single insert. Prices are whatever the caller passes: the service reads them
 * from the database.
 */
export function insertOrder(
  data: {
    userId: number;
    totalCents: number;
    lines: { productId: number; quantity: number; unitPriceCents: number }[];
  },
  db: Db = prisma,
): Promise<OrderWithItems> {
  return db.order.create({
    data: {
      userId: data.userId,
      totalCents: data.totalCents,
      items: { create: data.lines },
      stockMovements: {
        create: data.lines.map((l) => ({ productId: l.productId, quantity: -l.quantity, reason: "ORDER" as const })),
      },
    },
    include: orderInclude,
  });
}

/** Total units of a product the user has bought, across all their orders. */
export async function unitsOwned(userId: number, productId: number, db: Db = prisma): Promise<number> {
  const { _sum } = await db.orderItem.aggregate({
    where: { productId, order: { userId } },
    _sum: { quantity: true },
  });
  return _sum.quantity ?? 0;
}

/** The user's own orders, newest first. */
export function findOrdersByUser(userId: number): Promise<OrderWithItems[]> {
  return prisma.order.findMany({
    where: { userId },
    include: orderInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}
