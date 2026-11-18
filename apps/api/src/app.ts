import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { errorHandler, notFound } from "./middleware/errors.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { authRouter } from "./routes/auth.js";
import { ordersRouter } from "./routes/orders.js";
import { productsRouter } from "./routes/products.js";

export const app = express();

// Security headers (nosniff, frame blocking, a strict CSP, no X-Powered-By, ...).
app.use(helmet());
app.use(apiLimiter());
// Requests are small JSON bodies; reject anything bigger before parsing it.
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/products", productsRouter);
app.use("/orders", ordersRouter);

app.use(notFound);
app.use(errorHandler);
