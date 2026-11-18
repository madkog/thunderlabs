import type { Prisma, Product } from "../../generated/prisma/client.js";
import { AppError } from "../errors.js";
import { inTransaction } from "../repositories/db.js";
import { findOrdersByUser, insertOrder, unitsOwned, type OrderWithItems } from "../repositories/orders.js";
import { changeStockBy, findProductsByIds } from "../repositories/products.js";
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
  return inTransaction(async (tx) => {
    const products = await loadProducts(tx, items);
    await takeStock(tx, items, products);
    const order = await saveOrder(tx, userId, items, products);
    // Checked after writing on purpose. SQLite allows one writer at a time, so
    // a second order placed at the same moment can't write until this one
    // commits, and its check then sees this order. (On Postgres this would need
    // a row lock or a guarded counter instead; see the README.)
    await checkPurchaseLimit(tx, userId, items, products);
    return toOrderResponse(order);
  });
}

export async function listOrders(userId: number) {
  return (await findOrdersByUser(userId)).map(toOrderResponse);
}

/** Loads the ordered products, or throws 404 if any don't exist. */
async function loadProducts(tx: Tx, items: OrderItemInput[]): Promise<ProductsById> {
  const products = await findProductsByIds(
    items.map((i) => i.productId),
    tx,
  );
  const byId = new Map(products.map((p) => [p.id, p]));

  for (const { productId } of items) {
    if (!byId.has(productId)) throw productNotFound(productId);
  }
  return byId;
}

/** Takes the stock for each item, or throws 409 if there isn't enough. */
async function takeStock(tx: Tx, items: OrderItemInput[], products: ProductsById) {
  for (const { productId, quantity } of items) {
    if (!(await changeStockBy(productId, -quantity, tx))) {
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
  const totalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  return insertOrder({ userId, totalCents, lines }, tx);
}

/** Throws 409 if this order takes the customer over the limit for any product. */
async function checkPurchaseLimit(tx: Tx, userId: number, items: OrderItemInput[], products: ProductsById) {
  for (const { productId, quantity } of items) {
    const total = await unitsOwned(userId, productId, tx); // includes this order
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
