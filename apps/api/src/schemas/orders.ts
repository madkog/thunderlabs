import { z } from "zod";
import { MAX_UNITS_PER_PRODUCT } from "../services/orders.js";

// Only product IDs and quantities are accepted. Unknown fields (such as a
// price) are stripped, so the client can never set what it pays.
export const placeOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number({ error: "Choose a product" }).int().positive(),
        // Messages are shown to the customer, so they say what to do.
        quantity: z
          .number({ error: "Quantity must be a number" })
          .int({ error: "Quantity must be a whole number" })
          .min(1, { error: "Quantity must be at least 1" })
          .max(MAX_UNITS_PER_PRODUCT, {
            error: `You can buy at most ${MAX_UNITS_PER_PRODUCT} of each product`,
          }),
      }),
      { error: "Add at least one product" },
    )
    .min(1, { error: "Add at least one product" })
    .max(20, { error: "An order can have at most 20 products" })
    .refine(
      (items) => new Set(items.map((i) => i.productId)).size === items.length,
      "Each product can appear only once",
    ),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
