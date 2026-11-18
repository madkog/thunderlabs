"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api, ApiError, type Order } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { useUser } from "@/components/session-provider";

const dateFormat = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function OrdersPage() {
  const user = useUser();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user.role !== "CUSTOMER") return;
    let active = true;
    api.orders().then(
      ({ orders }) => active && setOrders(orders),
      (err) =>
        active &&
        setError(
          err instanceof ApiError
            ? err.message
            : "Something went wrong. Please try again.",
        ),
    );
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold">My orders</h1>

      {user.role !== "CUSTOMER" ? (
        <p className="text-muted-foreground">Admins don’t place orders.</p>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : orders === null ? (
        <p className="text-muted-foreground">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="text-muted-foreground">
          You haven’t placed any orders yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li
              key={order.id}
              className="rounded-2xl border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">Order #{order.id}</h2>
                <time
                  dateTime={order.createdAt}
                  className="text-sm text-muted-foreground"
                >
                  {dateFormat.format(new Date(order.createdAt))}
                </time>
              </div>
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {order.items.map((item) => (
                  <li
                    key={item.productId}
                    className="flex justify-between gap-4"
                  >
                    <span>
                      {item.quantity} × {item.name}
                    </span>
                    <span className="tabular-nums">
                      {formatPrice(item.unitPriceCents * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex justify-between gap-4 border-t pt-3 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatPrice(order.totalCents)}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
