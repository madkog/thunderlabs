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
- [ ] **User roles:** user (customer) and admin.
- [ ] **Authentication:** login for both roles with bcrypt-hashed passwords and JWT or session tokens. Protect routes by role.
- [ ] **Endpoints:**
  - Customer: log in, list available products with current prices, place an order, view own order history.
  - Admin: create a product, update a price, update stock.
- [ ] **Validation and errors:** validate all input, return consistent errors with correct status codes, add rate limiting and security headers.
- [ ] **Order rules** (server-side only):
  - The price is read from the database when the order is placed, never from the client.
  - A customer can buy at most 2 units.
  - Stock is checked and decremented, and the order saved, in a single transaction.
- [ ] **Front end:** product list page and order form. Order history and admin actions only need to work through the API.
- [ ] **Mobile:** make the pages responsive.
- [ ] **Testing:** API tests for every rule, including a concurrency test for the 2-unit limit and checks that customers are rejected from admin endpoints. Add Playwright tests for login and ordering.
- [ ] **README:** setup steps (install, migrate, seed, run), assumptions, what you would do next, and how you used AI tools.
