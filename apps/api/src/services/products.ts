import { AppError } from "../errors.js";
import { inTransaction } from "../repositories/db.js";
import {
  changeStockBy,
  findAllProducts,
  findProduct,
  insertProduct,
  insertStockMovement,
  unitsBoughtByProduct,
  updatePrice as savePrice,
} from "../repositories/products.js";

/**
 * All products, sold-out ones included so the store can show them as sold out.
 * purchasedCount is how many of each the given user has bought, across all
 * their orders (always 0 for admins, who can't order).
 */
export async function listProducts(userId: number) {
  const [products, bought] = await Promise.all([findAllProducts(), unitsBoughtByProduct(userId)]);
  return products.map((p) => ({ ...p, purchasedCount: bought.get(p.id) ?? 0 }));
}

export function createProduct(input: {
  name: string;
  description?: string;
  imageUrl?: string;
  priceCents: number;
  unitsInStock: number;
}) {
  return insertProduct(input);
}

export async function updatePrice(id: number, priceCents: number) {
  if (!(await savePrice(id, priceCents))) throw productNotFound(id);
  return (await findProduct(id))!;
}

/** Adds (or removes, if negative) stock and logs the change. Stock never goes below 0. */
export function changeStock(id: number, quantity: number, reason: "RESTOCK" | "ADJUSTMENT") {
  return inTransaction(async (tx) => {
    if (!(await changeStockBy(id, quantity, tx))) {
      if (!(await findProduct(id, tx))) throw productNotFound(id);
      throw new AppError(409, "INSUFFICIENT_STOCK", "Stock can't go below 0.");
    }
    await insertStockMovement({ productId: id, quantity, reason }, tx);
    return (await findProduct(id, tx))!;
  });
}

export function productNotFound(id: number) {
  return new AppError(404, "PRODUCT_NOT_FOUND", `Product ${id} doesn't exist.`);
}
