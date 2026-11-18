import { z } from "zod";

const priceCents = z.number().int().positive().max(10_000_000);

export const productIdParams = z.object({
  id: z.coerce.number().int().positive(),
});

// A path on the web app ("/products/x.svg") or an https URL. Anything else,
// such as "javascript:" or protocol-relative "//other.site", is rejected.
const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\/[^/]/.test(v), {
    error: "Image must be a path starting with / or an https URL",
  });

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  imageUrl: imageUrl.optional(),
  priceCents,
  unitsInStock: z.number().int().min(0).max(100_000).default(0),
});

export const updatePriceSchema = z.object({ priceCents });

// Stock only changes by a signed amount, never "set to N", so concurrent
// changes can't overwrite each other and every change is logged.
export const stockChangeSchema = z
  .object({
    quantity: z
      .number()
      .int()
      .min(-100_000)
      .max(100_000)
      .refine((n) => n !== 0, "Quantity can't be 0"),
    reason: z.enum(["RESTOCK", "ADJUSTMENT"]),
  })
  .refine((d) => d.reason !== "RESTOCK" || d.quantity > 0, {
    message: "A restock must add stock",
    path: ["quantity"],
  });
