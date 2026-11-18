# Thunder Labs Shop

A small shop for limited releases: customers log in, see what's available at today's price, and buy, with at most 2 of each product per customer. Admins load products and change prices and stock through the API.

- **API:** Express 5 + TypeScript, Prisma 7, SQLite (`apps/api`)
- **Web:** Next.js 16 + React 19, Tailwind, shadcn/ui (`apps/web`)
- **Tests:** 68 API tests with Vitest + Supertest

## Running it locally

Requires **Node 24** (Prisma 7 doesn't run on Node 21 or older).

```sh
nvm use                                   # reads .nvmrc
cp apps/api/.env.example apps/api/.env
npm run setup                             # install, generate Prisma client, migrate, seed
npm run dev                               # API on http://localhost:3001, web on http://localhost:3000
```

Open http://localhost:3000 and log in with one of these accounts:

| Role     | Email               | Password       |
| -------- | ------------------- | -------------- |
| Admin    | `admin@example.com` | `Admin123!`    |
| Customer | `alice@example.com` | `Customer123!` |
| Customer | `bob@example.com`   | `Customer123!` |

These demo passwords are written here only so reviewers can log in. In a real project they'd be set per environment and never committed. The database stores bcrypt hashes, not the passwords.

- **Tests:** `npm test`. They use their own `test.db` and never touch the dev data.
- **Reset the data:** `npm run seed -w api` restores the 3 seed products and removes all orders.
- **Admin actions:** these are API-only, as the brief allows. Every request is ready to send in [`apps/api/api.http`](apps/api/api.http) (VS Code REST Client), or use curl.

## API

All endpoints except login return 401 without a valid login cookie. Admin endpoints return 403 for customers. Every error has the same shape: `{ "error": { "code", "message", "details"? } }`.

| Method | Path                  | Who      | Body / result                                                                         |
| ------ | --------------------- | -------- | ------------------------------------------------------------------------------------- |
| POST   | `/auth/login`         | Anyone   | `{ email, password }`. Sets an httpOnly cookie.                                       |
| POST   | `/auth/logout`        | Anyone   | Clears the cookie.                                                                    |
| GET    | `/auth/me`            | Any user | The logged-in user.                                                                   |
| GET    | `/products`           | Any user | All products with current price, stock, and `purchasedCount` for the current user.    |
| POST   | `/orders`             | Customer | `{ items: [{ productId, quantity }] }`. Any price sent is ignored.                     |
| GET    | `/orders`             | Customer | The customer's own orders, newest first.                                              |
| POST   | `/products`           | Admin    | `{ name, description?, imageUrl?, priceCents, unitsInStock? }`                        |
| PATCH  | `/products/:id/price` | Admin    | `{ priceCents }`                                                                      |
| POST   | `/products/:id/stock` | Admin    | `{ quantity, reason }`: a signed change (`+10`, `-1`), `RESTOCK` or `ADJUSTMENT`.     |

## Database schema

```
User          id, email (unique), passwordHash, role (CUSTOMER | ADMIN)
Product       id, name, description?, imageUrl?, priceCents, unitsInStock
Order         id, userId → User, totalCents, createdAt
OrderItem     id, orderId → Order, productId → Product, quantity, unitPriceCents
StockMovement id, productId → Product, quantity (signed), reason (RESTOCK | ORDER | ADJUSTMENT), orderId? → Order, createdAt
```

Why it's shaped this way:

- **Money is whole cents (`Int`).** Floating-point money gives rounding errors. Dollars only appear when the web app formats a price for display.
- **`OrderItem.unitPriceCents` copies the price at the time of the order.** Prices change during the day, so an order must record what was actually charged, not point at the product's current price. This is how rule 3's "the price charged is saved on the order" is met.
- **Stock is one number on `Product`.** The brief describes one stock pool per product, so a separate inventory table would add a join for nothing. It's changed with a guarded update (`WHERE unitsInStock >= n`), which can't oversell. If the business added warehouses, I'd move stock to a one-to-many `Inventory` table (`productId` + `locationId`, unique together).
- **`StockMovement` is an append-only log of every stock change.** Each row is written in the same transaction as the change, so a product's movements always add up to its `unitsInStock` and you can always answer "why is stock 12?".
- **No "units bought" counter.** The 2-unit limit is calculated from the customer's `OrderItem` rows, so there's one source of truth that can't drift out of sync.
- **Foreign keys are indexed** (`Order.userId`, `OrderItem.orderId`/`productId`, `StockMovement.productId`/`orderId`) for order history and the limit check.
- **SQLite** means zero setup for reviewers. The schema uses nothing SQLite-specific, so moving to Postgres is mostly a provider change, apart from the concurrency point under rule 4.

Migrations are in `apps/api/prisma/migrations` and the seed is in `apps/api/prisma/seed.ts`.

## How the code is structured

```
apps/api/src/
  routes/         HTTP only: read the request, call a service, set the status and cookies
  services/       Business rules: login, the order rules, stock changes. No SQL, no HTTP.
  repositories/   Data access: every Prisma query, as small named functions
  schemas/        Zod schemas for every request body and URL parameter
  middleware/     requireAuth / requireRole, rate limits, error handler
  auth/token.ts   Signing and checking the login token, and the cookie settings
  app.ts          Wires it together (helmet, body limit, routers, error handler)
apps/api/tests/   API tests through the real HTTP stack and a real (test) database

apps/web/src/
  app/login/              Login page
  app/(store)/            Pages that need a login, sharing one layout (session + header)
  components/store/       Product card
  components/ui/          shadcn/ui components
  lib/api.ts              The only code that calls the API
  proxy.ts                Sends logged-out visitors to /login before the page loads
```

Why:

- **Three layers in the API**, as the brief asks. A rule like "at most 2 per product" lives in one service function, reads as plain steps, and can be followed without reading SQL or Express code. Repository functions take an optional transaction, so a service can run several of them as one unit.
- **Validation at the edge.** Every route parses its input with Zod before doing anything, so services only ever see valid, typed data. Unknown fields are dropped, which is also part of rule 3.
- **Errors are thrown, not returned.** Services throw an `AppError` (status, code, message), and one error handler turns every error into the same JSON shape. Unexpected errors become a generic 500, with details logged on the server only.
- **The web app is thin.** It shows the rules (stock, "You own 1 of 2"), but enforces nothing. The browser only talks to Next.js, which forwards `/api/*` to the API, so there's no CORS and the login cookie is same-origin.

## How each business rule is enforced

Every rule is enforced in the API, so calling it directly with curl gets the same result as using the website.

**1. Only logged-in customers can order; only admins can manage products.**
The login token is a JWT in an **httpOnly** cookie, so page JavaScript can't read or steal it. It's signed with HS256 only, so unsigned (`alg: none`) and forged tokens are rejected. Each router declares who can use it: `/orders` needs `requireAuth` + `requireRole("CUSTOMER")`, and the product write routes need `requireRole("ADMIN")`. Tested: no cookie gives 401, a forged, expired or tampered token gives 401, a customer on any admin endpoint gives 403, and an admin placing an order gives 403.

**2. Customers only see their own orders.**
`GET /orders` takes no user or order ID from the request. It always uses the ID from the verified token, so there's nothing to change to see someone else's orders. Tested: Bob's orders never appear in Alice's list.

**3. The price is worked out on the server, saved on the order, and anything the browser sends is ignored.**
The order schema accepts only `productId` and `quantity`, so any other field (a price, a total) is dropped before the code sees it. `placeOrder` reads each product's `priceCents` from the database inside the order transaction, works out the total, and saves both the unit price and the total on the order. Tested: sending `unitPriceCents: 1, totalCents: 1` still charges $29.99, and a price change after an order doesn't change the saved order.

**4. At most 2 units of a product per customer, across all their orders.**
Two checks:
- **One order:** a quantity over 2 is rejected (400) before anything happens.
- **Across orders:** inside the order transaction, after taking stock and saving the order, the service adds up the customer's units of that product, *including this order*. Over 2 throws, and the whole transaction is undone. Checking *after* writing is deliberate: SQLite allows one writer at a time, so a second order placed at the same moment can't write until the first commits, and its check then sees the first order.

Tested: 1 + 1 succeeds and then a third is refused, the limit is per customer, and 5 orders fired at the same moment give exactly 2 accepted.

*Limitation:* with SQLite and one API process, Prisma also runs transactions one at a time, so the concurrency test passes but can't tell this design from a naive "check, then write". On **Postgres** (default isolation), two simultaneous orders could each count before the other commits, so I'd add a lock: `SELECT … FOR UPDATE` on the customer's row at the start of the order, or a `purchases(userId, productId, units)` row changed with a guarded update, just as stock is.

**5. An order fully succeeds or fully fails.**
Taking stock, saving the order and its lines, logging the stock movements and the limit check all run in one database transaction. Any failure (unknown product, out of stock, over the limit) throws and rolls everything back. Tested: a failed order leaves stock unchanged and no order, order line or stock movement behind, even when the failing item was the second in the order.

**6. Quantities must be whole numbers of 1 or more.**
Zod requires an integer from 1 to 2. Tested with `0`, `-1`, `1.5`, `"1"` and `null`: all return 400 with a message pointing at the field.

**Also protected:** stock never goes below 0, even with simultaneous orders (guarded update, tested). Failed logins are rate-limited per email. Security headers are set on the API (helmet) and on the web pages (no framing, so nobody can trick a click on "Buy now"; no `X-Powered-By`). JSON bodies over 10kb are rejected. An unknown email and a wrong password get the same response, and take the same time.

## Assumptions and unknowns

- **"No more than 2 units of a product"** means per customer, per product, across all their orders ever: 1 now and 1 later is fine, and a third is refused. I didn't read it as 2 in total across all products, or 2 per order.
- **Orders are final.** There are no cancellations or refunds, so every order counts towards the limit.
- **One order can contain several products.** If any item fails, the whole order fails.
- **"Available" products** are listed even when sold out (shown as "Sold out"), so customers can see the drop. Only in-stock items can be bought.
- **Admins can't place orders** and have no order history.
- **Prices are in AUD, tax-inclusive, in a single currency.** "Charged" means the amount recorded on the order: there's no payment processing.
- **Stock is changed by an amount** (+10, -1), never "set to N", so two admins (or an admin and a sale) can't overwrite each other.
- **Admin actions are API-only**, as the brief allows.
- **Things I couldn't do and what I did instead:** I found that the Next.js `/api` proxy doesn't pass the browser's IP to the API (and passes through a fake one if a client sends it). So the API doesn't trust that header, and the login limit is keyed by email as well as IP. I also couldn't make the concurrency test prove the design on SQLite (see rule 4), so I wrote down the limitation and the Postgres fix instead of claiming more than the test shows.

**Questions I'd ask the business:**

1. Is the limit per release (drop) or for ever? If someone bought 2 in the summer drop, can they buy in the next one?
2. Per account, or per person? People can make extra accounts. Do we need checks on payment card, address or phone?
3. If the price changes between a customer seeing it and pressing Buy, should we charge the new price (what happens now) or ask them to confirm?
4. Can orders be cancelled or refunded, and should that free up the customer's limit?
5. How busy do drops get? Do we need a queue or bot protection for the first minutes?
6. Is stock ever split across locations or variants (sizes, colours)?

## What I'd do next

- **Admin screen** for loading items and changing prices and stock (the API is ready, and a design spec exists).
- **Postgres, plus a lock for the purchase limit** (see rule 4), with the concurrency tests run against several connections.
- **Price-change log** (old price, new price, who, when), alongside the existing stock log.
- **Playwright end-to-end tests** for login and ordering, and CI running lint, type checks and all tests on each push.
- **Shared rate-limit store** (Redis) and a front proxy that sets `X-Forwarded-For`, so limits work per real IP across several API instances.
- **Session revocation:** short tokens plus a refresh token, or a server-side session table, so a role change or a ban takes effect immediately instead of when the 1-hour token expires.
- **Front end:** TanStack Query for fetching and caching, and types shared with the API instead of repeated in `lib/api.ts`.

## Design notes and trade-offs

- **Roles come from the login token.** A role change takes effect when the 1-hour token expires. Checking the database on every request would make it immediate, at the cost of one query per request.
- **Rate limits are in memory:** 5 failed logins per email per 15 minutes, and 300 requests per IP per minute. They reset on restart and aren't shared between instances.
- **CSRF:** the cookie is `SameSite=Lax`, so other sites can't send it with a POST, and the API only reads JSON bodies, which a plain HTML form can't send.
- **Pages render in the browser.** The cookie is httpOnly, so the pages ask the API who is logged in (`/auth/me`, once, in the shared `(store)` layout). `proxy.ts` sends visitors with no cookie straight to `/login`, but only checks that the cookie exists: the API checks the token on every request. Rendering on the server would mean forwarding the cookie from Next.js to the API, which is more moving parts for a minimal front end.
- **Product images** are an optional `imageUrl`, limited to site paths or `https://` links, so an admin can't save a `javascript:` URL that every customer's browser would load. The seed images are simple SVG illustrations generated with AI for the demo.
- **No UI tests.** The brief says they aren't needed, so the testing time went into API tests for the rules.

## How I used AI tools

> **Draft. Edit this so it describes your own experience accurately before submitting.**

I used **Claude Code** (Anthropic) as a pair programmer throughout, and a separate AI chat for UI design specs.

- **What it helped with:** scaffolding the workspace, writing most of the first drafts of the API, tests and pages, looking up Prisma 7 and Next.js 16 changes, and checking my work against the brief.
- **Decisions I made:**
  - keeping stock on `Product` with a `StockMovement` log instead of a 1:1 inventory table
  - httpOnly cookies instead of a Bearer header
  - reading the 2-unit rule as per product, across all orders
  - allowing several products per order
  - splitting data access into repositories
  - cutting the admin screen, the audit-log extension and UI tests once I checked them against the brief
  - designing the store UI myself, with another AI as a design tool
- **What I checked and corrected:** I ran every feature by hand and in tests, and asked for best-practice checks before accepting code. Things caught along the way:
  - the API wasn't loading `.env` (every login would have failed)
  - Tailwind wasn't registered with Next.js (the CSS didn't build)
  - the Next.js proxy hides client IPs (which changed how login rate limiting works)
  - validation messages weren't readable by customers
  - the concurrency test can't prove the design on SQLite, so the README states that limitation instead of overclaiming
- I reviewed each change before committing it in small steps (AI drafted most commit messages to my conventions), and can explain every decision.

## A note to the General Manager

We've built the online shop for your limited releases. Customers log in, see each item with its price right now and how many are left, and buy. Your team can add new items and change prices and stock at any time, and every stock change is recorded. The two problems you mentioned are now blocked by the system itself, not just by the website: each customer can buy **at most 2 of any item, across all their orders**, even if they place several orders at the same moment; and **the price is always taken from our records when the order is placed**, so changing the price in the browser has no effect, and the order keeps the price actually charged. One thing it doesn't do yet: there's no screen for your team to manage items. For now that's done through a technical tool, and a simple admin page would be the next thing to build. It also doesn't stop one person using several accounts to get around the limit, which we should talk about.
