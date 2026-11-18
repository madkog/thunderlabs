"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/store/product-card";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api, ApiError, type Order, type Product } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUser } from "@/components/session-provider";

type Feedback =
  { kind: "success"; order: Order } | { kind: "error"; message: string } | null;

export default function StorePage() {
  const user = useUser();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Load products on mount. purchasedCount is for the logged-in user.
  useEffect(() => {
    let active = true;
    api.products().then(
      (products) => active && setProducts(products),
      (err) => active && setLoadError(messageOf(err)),
    );
    return () => {
      active = false;
    };
  }, []);

  async function buy(productId: number, quantity: number) {
    setBuyingId(productId);
    setFeedback(null);
    try {
      // Only the product and quantity. The server works out the price.
      const { order } = await api.placeOrder([{ productId, quantity }]);
      setFeedback({ kind: "success", order });
    } catch (err) {
      setFeedback({ kind: "error", message: messageOf(err) });
    }
    // Refetch after every order: stock and purchase counts may have changed.
    try {
      setProducts(await api.products());
    } catch (err) {
      setLoadError(messageOf(err));
    }
    setBuyingId(null);
  }

  const isCustomer = user.role === "CUSTOMER";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <section className="rounded-2xl border bg-gradient-to-br from-amber-900/25 to-slate-700/25 p-6">
        <p className="text-xs font-bold tracking-widest text-sky-400 uppercase">
          Live now
        </p>
        <h1 className="mt-1 text-[26px] leading-tight font-bold">
          Summer Collectors Drop
        </h1>
        <p className="mt-1 text-muted-foreground">
          Limited stock. Up to 2 per product per customer. Prices can change
          during the day.
        </p>
      </section>

      {!isCustomer && (
        <Alert>
          <AlertDescription>You’re logged in as an admin.</AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {products === null ? (
        !loadError && <p className="text-muted-foreground">Loading products…</p>
      ) : products.length === 0 ? (
        <p className="text-muted-foreground">No products yet.</p>
      ) : (
        <section
          aria-label="Products"
          className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3"
        >
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              canBuy={isCustomer}
              buying={buyingId === product.id}
              onBuy={buy}
            />
          ))}
        </section>
      )}

      {/* Below the grid, but sticky: on a phone it stays at the bottom of the
          screen, so you see the result without scrolling. Opaque backgrounds
          because it can sit over the cards. */}
      <div aria-live="polite" className="sticky bottom-4 z-10">
        {feedback && (
          <Alert
            variant={feedback.kind === "error" ? "destructive" : "default"}
            className={cn(
              "shadow-lg",
              feedback.kind === "success" &&
                "border-emerald-500/30 bg-emerald-950",
            )}
          >
            <AlertDescription
              className={cn(feedback.kind === "success" && "text-foreground")}
            >
              {feedback.kind === "success" ? (
                <>
                  <strong>Order placed.</strong> {describeOrder(feedback.order)}
                </>
              ) : (
                feedback.message
              )}
            </AlertDescription>
            <AlertAction className="top-1/2 right-1.5 -translate-y-1/2">
              <Button
                variant="ghost"
                size="icon"
                className="size-10"
                aria-label="Dismiss"
                onClick={() => setFeedback(null)}
              >
                <HugeiconsIcon icon={Cancel01Icon} />
              </Button>
            </AlertAction>
          </Alert>
        )}
      </div>
    </main>
  );
}

/** "1 × Storm Figurine, charged $49.00." using the server's prices. */
function describeOrder(order: Order): string {
  const items = order.items.map((i) => `${i.quantity} × ${i.name}`).join(", ");
  return `${items}, charged ${formatPrice(order.totalCents)}.`;
}

function messageOf(err: unknown): string {
  return err instanceof ApiError
    ? err.message
    : "Something went wrong. Please try again.";
}
