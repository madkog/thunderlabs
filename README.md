# thunderlabs

Tech assessment

## Getting started

Requires Node 24 (Prisma 7 does not run on older versions such as 21).

```sh
nvm use                                   # reads .nvmrc (Node 24)
cp apps/api/.env.example apps/api/.env
npm run setup                             # install, apply migrations, seed
npm run dev                               # API on http://localhost:3001, web on http://localhost:3000
```

To reset the data to the seed state, run `npm run seed -w api` again.

## API

All endpoints except login return 401 without a login cookie. Admin endpoints return 403 for customers. Errors are always `{ "error": { "code", "message", "details"? } }`. Ready-made requests are in [`apps/api/api.http`](apps/api/api.http) (VS Code REST Client).

| Method | Path                  | Who      | What                                                         |
| ------ | --------------------- | -------- | ------------------------------------------------------------ |
| POST   | `/auth/login`         | Anyone   | `{ email, password }`. Sets an httpOnly cookie.              |
| POST   | `/auth/logout`        | Anyone   | Clears the cookie.                                           |
| GET    | `/auth/me`            | Any user | The logged-in user.                                          |
| GET    | `/products`           | Any user | All products with current prices, stock, and `purchasedCount` (how many the user has bought). |
| POST   | `/orders`             | Customer | `{ items: [{ productId, quantity }] }`. Price comes from the database. |
| GET    | `/orders`             | Customer | Own order history, newest first.                             |
| POST   | `/products`           | Admin    | `{ name, description?, priceCents, unitsInStock? }`          |
| PATCH  | `/products/:id/price` | Admin    | `{ priceCents }`                                             |
| POST   | `/products/:id/stock` | Admin    | `{ quantity, reason }`: signed change, `RESTOCK` or `ADJUSTMENT`. |

Prices are integer cents, so there are no rounding errors. Stock is changed by an amount (+10, -1), never set to a number, so two admins can't overwrite each other, and every change is logged in `StockMovement`.

## Demo logins

`npm run seed -w api` creates these accounts:

| Role     | Email               | Password       |
| -------- | ------------------- | -------------- |
| Admin    | `admin@example.com` | `Admin123!`    |
| Customer | `alice@example.com` | `Customer123!` |
| Customer | `bob@example.com`   | `Customer123!` |

These are demo passwords, written here so reviewers can log in. In a real project they would be set only in `.env` (see `apps/api/.env.example`) and never committed. The seed hashes them with bcrypt, so the database never stores them as plain text.

It also creates 3 products. The USB-C Hub has only 3 units in stock, to exercise the stock and 2-unit rules. Re-running the seed resets products and orders.

## Development process

Build in this order and check each step before moving on.

- [x] **Base stack:** Next.js with React and TypeScript for the front end.
- [x] **Backend:** a separate Express API in TypeScript.
- [x] **Database:** Prisma with the base migration. Add a `.env.example`.
- [x] **Seed data:** 3 products, 2 customers, 1 admin.
- [x] **User roles:** user (customer) and admin.
- [x] **Authentication:** login for both roles with bcrypt-hashed passwords and JWT or session tokens. Protect routes by role.
- [x] **Endpoints:**
  - Customer: log in, list available products with current prices, place an order, view own order history.
  - Admin: create a product, update a price, update stock.
- [x] **Validation and errors:** validate all input, return consistent errors with correct status codes, add rate limiting and security headers.
- [x] **Order rules** (server-side only):
  - The price is read from the database when the order is placed, never from the client.
  - A customer can buy at most 2 units (of each product, across all their orders).
  - Stock is checked and decremented, and the order saved, in a single transaction.
- [x] **Front end:** product list page and order form. Order history and admin actions only need to work through the API.
- [x] **Mobile:** make the pages responsive.
- [ ] **Testing:** API tests for every rule, including a concurrency test for the 2-unit limit and checks that customers are rejected from admin endpoints. Add Playwright tests for login and ordering.
- [ ] **README:** setup steps (install, migrate, seed, run), assumptions, what you would do next, and how you used AI tools.

## Trade-offs and next steps

- **No admin screen, by design.** The brief says admin actions only need to work through the API, so admins create products and update prices and stock with the API (requests ready in [`apps/api/api.http`](apps/api/api.http)). If an admin logs in to the website, they see the product list, including sold-out items, with no buy controls and a note that they’re logged in as an admin. Next step: an admin screen for loading new items and adjusting prices and stock, using the same endpoints.
- **Roles come from the login token.** The token lasts 1 hour, so if an admin changes a user's role, it takes effect when that user's token expires. Checking the database on every request would make it immediate, at the cost of one extra query per request.
- **Concurrency.** Orders take stock with a conditional update (`unitsInStock >= qty`) and check the 2-unit limit after writing, all in one transaction, so they stay correct when several API processes share a database. With SQLite and one API process, Prisma also runs transactions one at a time, so the concurrency tests can't tell this design from a naive "check, then write" one. Running them against Postgres with several connections would.
- **Multiple warehouses.** Stock is one number on `Product`, which is all the brief needs. If the business adds warehouses, I'd move it to a one-to-many `Inventory` table (`productId` + `locationId`, unique together).
- **Rate limits are in memory.** Failed logins are limited to 5 per email per 15 minutes, and all requests to 300 per IP per minute. The counters live in the API process, so they reset on restart and aren't shared between instances. With several instances I'd use a shared store such as Redis.
- **The Next.js proxy hides the browser's IP.** I checked: its `/api` rewrite doesn't add `X-Forwarded-For`, and it passes through any value a client sends. So the API doesn't trust that header, every browser counts as one IP, and the login limit is keyed by email as well as IP. In production I'd put a proxy in front that sets `X-Forwarded-For` (for example nginx), then enable Express's `trust proxy` for it.
- **CSRF.** The login cookie is `SameSite=Lax`, so other sites can't send it with a POST, and the API only reads JSON bodies, which a plain HTML form can't send. A CSRF token would add another layer if the cookie policy ever had to be relaxed.
- **The pages render in the browser.** The login cookie is httpOnly, so the pages ask the API who is logged in (`/auth/me`, once, in the shared `(store)` layout) and load data with `fetch` through the `/api` proxy. A Next.js `proxy.ts` sends visitors with no login cookie straight to `/login`; it only checks that the cookie exists, and the API still checks the token on every request. Rendering on the server would mean forwarding the cookie from Next.js to the API, which is more moving parts for a minimal front end.
- **Front-end next steps.** Use TanStack Query (or SWR) for caching and refetching instead of hand-written `useEffect` fetching, and share the API's types with the web app (a workspace package or types generated from an OpenAPI spec) instead of repeating them in `apps/web/src/lib/api.ts`.
- **The web app only shows the rules; the API enforces them.** The product cards show the 2-unit limit and stock, and the quantity box only accepts whole numbers, but the API checks every rule again and the page shows its error message as is.
