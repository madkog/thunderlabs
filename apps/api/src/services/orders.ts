import type { Prisma, Product } from "../../generated/prisma/client.js";
import { prisma } from "../db/client.js";
import { AppError } from "../errors.js";
import { productNotFound } from "./products.js";

/** A customer can own at most this many units of each product, across all their orders. */
export const MAX_UNITS_PER_PRODUCT = 2;

type Tx = Prisma.TransactionClient;
type OrderItemInput = { productId: number; quantity: number };
type ProductsById = Map<number, Product>;

/**
 * Places an order in one transaction: if any step fails, nothing changes.
 */
export function placeOrder(userId: number, items: OrderItemInput[]) {
  return prisma.$transaction(async (tx) => {
    const products = await loadProducts(tx, items);
    await takeStock(tx, items, products);
    const order = await saveOrder(tx, userId, items, products);
    // Checked after writing on purpose: a second order placed at the same
    // moment can't write until this one commits, so its check sees this order.
    await checkPurchaseLimit(tx, userId, items, products);
    return toOrderResponse(order);
  });
}

export async function listOrders(userId: number) {
  const orders = await prisma.order.findMany({
    where: { userId },
    include: orderInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return orders.map(toOrderResponse);
}

/** Loads the ordered products, or throws 404 if any don't exist. */
async function loadProducts(tx: Tx, items: OrderItemInput[]): Promise<ProductsById> {
  const products = await tx.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  for (const { productId } of items) {
    if (!byId.has(productId)) throw productNotFound(productId);
  }
  return byId;
}

/**
 * Decrements stock, or throws 409 if there isn't enough. The check and the
 * decrement are one statement, so the last unit can't be sold twice.
 */
async function takeStock(tx: Tx, items: OrderItemInput[], products: ProductsById) {
  for (const { productId, quantity } of items) {
    const { count } = await tx.product.updateMany({
      where: { id: productId, unitsInStock: { gte: quantity } },
      data: { unitsInStock: { decrement: quantity } },
    });
    if (count === 0) {
      const name = products.get(productId)!.name;
      throw new AppError(409, "OUT_OF_STOCK", `Not enough ${name} in stock.`, { productId });
    }
  }
}

/** Saves the order and its stock movements. Prices come from the database, never the client. */
function saveOrder(tx: Tx, userId: number, items: OrderItemInput[], products: ProductsById) {
  const lines = items.map(({ productId, quantity }) => ({
    productId,
    quantity,
    unitPriceCents: products.get(productId)!.priceCents,
  }));

  return tx.order.create({
    data: {
      userId,
      totalCents: lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0),
      items: { create: lines },
      stockMovements: {
        create: items.map(({ productId, quantity }) => ({
          productId,
          quantity: -quantity,
          reason: "ORDER" as const,
        })),
      },
    },
    include: orderInclude,
  });
}

/** Throws 409 if this order takes the customer over the limit for any product. */
async function checkPurchaseLimit(tx: Tx, userId: number, items: OrderItemInput[], products: ProductsById) {
  for (const { productId, quantity } of items) {
    const { _sum } = await tx.orderItem.aggregate({
      where: { productId, order: { userId } },
      _sum: { quantity: true },
    });
    const total = _sum.quantity ?? 0; // includes this order
    if (total > MAX_UNITS_PER_PRODUCT) {
      const alreadyBought = total - quantity;
      const name = products.get(productId)!.name;
      throw new AppError(
        409,
        "PURCHASE_LIMIT",
        `You can buy at most ${MAX_UNITS_PER_PRODUCT} ${name}. You already have ${alreadyBought}.`,
        { productId, limit: MAX_UNITS_PER_PRODUCT, alreadyBought },
      );
    }
  }
}

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

type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function toOrderResponse(order: OrderWithItems) {
  return {
    id: order.id,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    items: order.items.map((i) => ({
      productId: i.productId,
      name: i.product.name,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
    })),
  };
}
