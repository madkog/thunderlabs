import { prisma } from "../db/client.js";
import { AppError } from "../errors.js";

export const productFields = {
  id: true,
  name: true,
  description: true,
  priceCents: true,
  unitsInStock: true,
} as const;

/** Customers see products in stock. Admins also see sold-out ones. */
export function listProducts({ includeSoldOut }: { includeSoldOut: boolean }) {
  return prisma.product.findMany({
    where: includeSoldOut ? {} : { unitsInStock: { gt: 0 } },
    select: productFields,
    orderBy: { name: "asc" },
  });
}

export function createProduct(input: {
  name: string;
  description?: string;
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
