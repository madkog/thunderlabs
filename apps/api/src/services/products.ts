import { prisma } from "../db/client.js";
import { AppError } from "../errors.js";

export const productFields = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  priceCents: true,
  unitsInStock: true,
} as const;

/**
 * All products, sold-out ones included so the shop can show them as sold out.
 * purchasedCount is how many of each the given user has bought, across all
 * their orders (always 0 for admins, who can't order).
 */
export async function listProducts(userId: number) {
  const [products, purchased] = await Promise.all([
    prisma.product.findMany({ select: productFields, orderBy: { name: "asc" } }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { userId } },
      _sum: { quantity: true },
    }),
  ]);

  const countByProduct = new Map(purchased.map((p) => [p.productId, p._sum.quantity ?? 0]));
  return products.map((p) => ({ ...p, purchasedCount: countByProduct.get(p.id) ?? 0 }));
}

export function createProduct(input: {
  name: string;
  description?: string;
  imageUrl?: string;
  priceCents: number;
  unitsInStock: number;
}) {
  return prisma.product.create({
    data: {
      ...input,
      // Log the starting stock, so movements always add up to unitsInStock.
      stockMovements:
        input.unitsInStock > 0
          ? { create: { quantity: input.unitsInStock, reason: "RESTOCK" } }
          : undefined,
    },
    select: productFields,
  });
}

export async function updatePrice(id: number, priceCents: number) {
  const { count } = await prisma.product.updateMany({ where: { id }, data: { priceCents } });
  if (count === 0) throw productNotFound(id);
  return prisma.product.findUniqueOrThrow({ where: { id }, select: productFields });
}

/** Adds (or removes, if negative) stock and logs the change. Stock never goes below 0. */
export function changeStock(id: number, quantity: number, reason: "RESTOCK" | "ADJUSTMENT") {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.product.updateMany({
      // For a decrease, only match if there's enough stock. This check and the
      // update are one statement, so a concurrent order can't slip in between.
      where: { id, ...(quantity < 0 && { unitsInStock: { gte: -quantity } }) },
      data: { unitsInStock: { increment: quantity } },
    });
    if (count === 0) {
      const exists = await tx.product.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw productNotFound(id);
      throw new AppError(409, "INSUFFICIENT_STOCK", "Stock can't go below 0.");
    }

    await tx.stockMovement.create({ data: { productId: id, quantity, reason } });
    return tx.product.findUniqueOrThrow({ where: { id }, select: productFields });
  });
}

export function productNotFound(id: number) {
  return new AppError(404, "PRODUCT_NOT_FOUND", `Product ${id} doesn't exist.`);
}
