const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

/** 2999 → "$29.99". Prices are integer cents everywhere, and only formatted for display. */
export function formatPrice(cents: number): string {
  return currency.format(cents / 100);
}
