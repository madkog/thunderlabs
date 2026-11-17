# thunderlabs

Tech assessment

## Development process

Build in this order and check each step before moving on.

- [x] **Base stack:** Next.js with React and TypeScript for the front end.
- [x] **Backend:** a separate Express API in TypeScript.
- [x] **Database:** Prisma with the base migration. Add a `.env.example`.
- [ ] **Seed data:** 3 products, 2 customers, 1 admin.
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
