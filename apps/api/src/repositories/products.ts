import { prisma, type Db } from "./db.js";

/** The product fields sent to clients. */
export const productFields = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  priceCents: true,
  unitsInStock: true,
} as const;

export function findAllProducts() {
  return prisma.product.findMany({ select: productFields, orderBy: { name: "asc" } });
}

export function findProduct(id: number, db: Db = prisma) {
  return db.product.findUnique({ where: { id }, select: productFields });
}

export function findProductsByIds(ids: number[], db: Db = prisma) {
  return db.product.findMany({ where: { id: { in: ids } } });
}

/** How many units of each product the user has bought, across all their orders. */
export async function unitsBoughtByProduct(userId: number): Promise<Map<number, number>> {
  const rows = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { userId } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.productId, r._sum.quantity ?? 0]));
}

/** Creates a product, logging its starting stock so movements add up to unitsInStock. */
export function insertProduct(data: {
  name: string;
  description?: string;
  imageUrl?: string;
  priceCents: number;
  unitsInStock: number;
}) {
  return prisma.product.create({
    data: {
      ...data,
      stockMovements:
        data.unitsInStock > 0 ? { create: { quantity: data.unitsInStock, reason: "RESTOCK" } } : undefined,
    },
    select: productFields,
  });
}

/** Returns false if there's no product with this id. */
export async function updatePrice(id: number, priceCents: number): Promise<boolean> {
  const { count } = await prisma.product.updateMany({ where: { id }, data: { priceCents } });
  return count > 0;
}

/**
 * Changes stock by delta (negative to remove). A decrease only applies if there
 * is enough stock: the check and the update are one SQL statement, so two
 * changes at the same moment can't both take the last unit.
 * Returns false if nothing changed (no such product, or not enough stock).
 */
export async function changeStockBy(id: number, delta: number, db: Db = prisma): Promise<boolean> {
  const { count } = await db.product.updateMany({
    where: { id, ...(delta < 0 && { unitsInStock: { gte: -delta } }) },
    data: { unitsInStock: { increment: delta } },
  });
  return count > 0;
}

export function insertStockMovement(
  data: { productId: number; quantity: number; reason: "RESTOCK" | "ADJUSTMENT" },
  db: Db = prisma,
) {
  return db.stockMovement.create({ data });
}
