import { z } from "zod";
import { MAX_UNITS_PER_PRODUCT } from "../services/orders.js";

// Only product IDs and quantities are accepted. Unknown fields (such as a
// price) are stripped, so the client can never set what it pays.
export const placeOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(MAX_UNITS_PER_PRODUCT),
      }),
    )
    .min(1)
    .max(20)
    .refine(
      (items) => new Set(items.map((i) => i.productId)).size === items.length,
      "Each product can appear only once",
    ),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
