import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  createProductSchema,
  productIdParams,
  stockChangeSchema,
  updatePriceSchema,
} from "../schemas/products.js";
import { validate } from "../schemas/validate.js";
import { changeStock, createProduct, listProducts, updatePrice } from "../services/products.js";

export const productsRouter = Router();

productsRouter.use(requireAuth);

productsRouter.get("/", async (req, res) => {
  const products = await listProducts(req.user!.id);
  res.json({ products });
});

productsRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const input = validate(createProductSchema, req.body);
  res.status(201).json({ product: await createProduct(input) });
});

productsRouter.patch("/:id/price", requireRole("ADMIN"), async (req, res) => {
  const { id } = validate(productIdParams, req.params);
  const { priceCents } = validate(updatePriceSchema, req.body);
  res.json({ product: await updatePrice(id, priceCents) });
});

productsRouter.post("/:id/stock", requireRole("ADMIN"), async (req, res) => {
  const { id } = validate(productIdParams, req.params);
  const { quantity, reason } = validate(stockChangeSchema, req.body);
  res.json({ product: await changeStock(id, quantity, reason) });
});
