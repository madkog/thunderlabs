"use client";

import { useState, type SubmitEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Product } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Mirrors the server's rule for display. The server is what enforces it. */
export const LIMIT_PER_PRODUCT = 2;
const LOW_STOCK = 3;
// The stock bar is a visual hint only: it's full at this many units.
const FULL_BAR_AT = 15;

type StockStatus = "in" | "low" | "out";

const statusStyles: Record<StockStatus, { label: string; dot: string; image: string; bar: string }> = {
  in: { label: "In stock", dot: "bg-emerald-500", image: "bg-sky-900/30", bar: "bg-sky-400" },
  low: { label: "Low stock", dot: "bg-amber-500", image: "bg-amber-900/35", bar: "bg-amber-500" },
  out: { label: "Sold out", dot: "bg-red-500", image: "bg-neutral-800/60", bar: "bg-transparent" },
};

function stockStatus(stock: number): StockStatus {
  if (stock === 0) return "out";
  return stock <= LOW_STOCK ? "low" : "in";
}

type Props = {
  product: Product;
  /** False for admins, who can't place orders. */
  canBuy: boolean;
  buying: boolean;
  onBuy: (productId: number, quantity: number) => void;
};

export function ProductCard({ product, canBuy, buying, onBuy }: Props) {
  const [quantity, setQuantity] = useState("1");

  const status = stockStatus(product.stock);
  const styles = statusStyles[status];
  const limitReached = product.purchasedCount >= LIMIT_PER_PRODUCT;
  const unavailable = status === "out" || limitReached;
  // A whole number of 1 or more. The server checks this too.
  const quantityValid = /^[1-9]\d*$/.test(quantity);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (quantityValid) onBuy(product.id, Number(quantity));
  }

  return (
    // size="sm" gives 16px padding. pt-0 lets the image run to the card's top edge.
    <Card
      size="sm"
      role="article"
      aria-labelledby={`product-${product.id}`}
      className={cn("pt-0 shadow-sm transition-opacity", unavailable && "opacity-60")}
    >
      <div className={cn("relative flex aspect-[4/3] items-center justify-center", styles.image)}>
        <span className="text-sm text-muted-foreground">Product image</span>
        <Badge variant="secondary" className="absolute top-3 left-3 h-6 gap-1.5 bg-background/80 px-2.5 backdrop-blur">
          <span aria-hidden className={cn("size-2 rounded-full", styles.dot)} />
          {styles.label}
        </Badge>
      </div>

      <CardHeader className="gap-0.5">
        <CardTitle className="font-semibold">
          <h3 id={`product-${product.id}`}>{product.name}</h3>
        </CardTitle>
        {product.description && <CardDescription>{product.description}</CardDescription>}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <p className={cn("text-2xl font-bold tabular-nums", status === "out" && "text-muted-foreground")}>
          {formatPrice(product.priceCents)}
        </p>

        <div className="flex flex-col gap-1.5">
          <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className={cn("h-full rounded-full", styles.bar)}
              style={{ width: `${Math.min(product.stock / FULL_BAR_AT, 1) * 100}%` }}
            />
          </div>
          <div className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span>{product.stock} left</span>
            {canBuy && (
              <span>
                You own {product.purchasedCount} of {LIMIT_PER_PRODUCT}
              </span>
            )}
          </div>
        </div>
      </CardContent>

      {canBuy && (
        <CardFooter className="mt-auto">
          {unavailable ? (
            <Button variant="outline" size="lg" className="w-full rounded-lg" disabled>
              {status === "out" ? "Sold out" : "Limit reached"}
            </Button>
          ) : (
            <form onSubmit={handleSubmit} className="flex w-full gap-2">
              <label htmlFor={`qty-${product.id}`} className="sr-only">
                Quantity of {product.name}
              </label>
              <Input
                id={`qty-${product.id}`}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                aria-invalid={!quantityValid}
                className="h-10 rounded-lg text-center"
              />
              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="shrink-0 rounded-lg whitespace-nowrap"
                disabled={!quantityValid || buying}
              >
                {buying ? "Buying…" : "Buy now"}
              </Button>
            </form>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
