import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { placeOrderSchema } from "../schemas/orders.js";
import { validate } from "../schemas/validate.js";
import { listOrders, placeOrder } from "../services/orders.js";

export const ordersRouter = Router();

ordersRouter.use(requireAuth, requireRole("CUSTOMER"));

/** The logged-in customer's own orders, newest first. */
ordersRouter.get("/", async (req, res) => {
  res.json({ orders: await listOrders(req.user!.id) });
});

ordersRouter.post("/", async (req, res) => {
  const { items } = validate(placeOrderSchema, req.body);
  res.status(201).json({ order: await placeOrder(req.user!.id, items) });
});
