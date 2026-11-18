// The browser talks to the API through the Next.js /api proxy (next.config.ts),
// so requests are same-origin and the httpOnly login cookie is sent automatically.

export type Role = "CUSTOMER" | "ADMIN";

export type User = { id: number; email: string; role: Role };

export type Product = {
  id: number;
  name: string;
  description: string | null;
  priceCents: number;
  stock: number;
  /** How many the logged-in customer has bought, across all their orders. */
  purchasedCount: number;
};

type ApiProduct = Omit<Product, "stock"> & { unitsInStock: number };

export type Order = {
  id: number;
  totalCents: number;
  createdAt: string;
  items: { productId: number; name: string; quantity: number; unitPriceCents: number }[];
};

/** An error response from the API: { error: { code, message, details? } }. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init?.method ?? "GET",
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.code ?? "UNKNOWN_ERROR",
      data?.error?.message ?? "Something went wrong. Please try again.",
    );
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: User }>("/auth/login", { method: "POST", body: { email, password } }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/auth/me"),
  products: async (): Promise<Product[]> => {
    const { products } = await request<{ products: ApiProduct[] }>("/products");
    return products.map(({ unitsInStock, ...p }) => ({ ...p, stock: unitsInStock }));
  },
  orders: () => request<{ orders: Order[] }>("/orders"),
  placeOrder: (items: { productId: number; quantity: number }[]) =>
    request<{ order: Order }>("/orders", { method: "POST", body: { items } }),
};
