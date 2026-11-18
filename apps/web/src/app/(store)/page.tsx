"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/store/product-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api, ApiError, type Order, type Product } from "@/lib/api";
import { formatPrice } from "@/lib/format";
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

      <div aria-live="polite">
        {feedback?.kind === "success" && (
          <Alert className="border-emerald-500/30 bg-emerald-500/10">
            <AlertDescription className="text-foreground">
              <strong>Order placed.</strong> {describeOrder(feedback.order)}
            </AlertDescription>
          </Alert>
        )}
        {feedback?.kind === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{feedback.message}</AlertDescription>
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
