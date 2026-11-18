import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/db/client.js";
import { createProduct, createUser, loginCookie, resetDb } from "./helpers.js";

let alice: string;
let bob: string;
let admin: string;
let mouse: { id: number };
let hub: { id: number };

beforeEach(async () => {
  await resetDb();
  await createUser("alice@test.com", "CUSTOMER");
  await createUser("bob@test.com", "CUSTOMER");
  await createUser("admin@test.com", "ADMIN");
  [alice, bob, admin] = await Promise.all([
    loginCookie("alice@test.com"),
    loginCookie("bob@test.com"),
    loginCookie("admin@test.com"),
  ]);
  mouse = await createProduct({ name: "Mouse", priceCents: 2999, unitsInStock: 50 });
  hub = await createProduct({ name: "Hub", priceCents: 4999, unitsInStock: 3 });
});

afterAll(() => prisma.$disconnect());

function order(cookie: string, items: unknown) {
  return request(app).post("/orders").set("Cookie", cookie).send({ items });
}

const stockOf = async (id: number) => (await prisma.product.findUniqueOrThrow({ where: { id } })).unitsInStock;

describe("POST /orders", () => {
  it("places an order with several products, at database prices", async () => {
    const res = await order(alice, [
      { productId: mouse.id, quantity: 2 },
      { productId: hub.id, quantity: 1 },
    ]);

    expect(res.status).toBe(201);
    expect(res.body.order.totalCents).toBe(2 * 2999 + 4999);
    expect(res.body.order.items).toEqual([
      { productId: mouse.id, name: "Mouse", quantity: 2, unitPriceCents: 2999 },
      { productId: hub.id, name: "Hub", quantity: 1, unitPriceCents: 4999 },
    ]);
    expect(await stockOf(mouse.id)).toBe(48);
    expect(await stockOf(hub.id)).toBe(2);
  });

  it("logs a stock movement per item, linked to the order", async () => {
    const res = await order(alice, [{ productId: hub.id, quantity: 2 }]);
    const movement = await prisma.stockMovement.findFirst({ where: { orderId: res.body.order.id } });
    expect(movement).toMatchObject({ productId: hub.id, quantity: -2, reason: "ORDER" });
  });

  it("ignores a price sent by the client", async () => {
    const res = await request(app)
      .post("/orders")
      .set("Cookie", alice)
      .send({ items: [{ productId: mouse.id, quantity: 1, unitPriceCents: 1 }], totalCents: 1 });
    expect(res.status).toBe(201);
    expect(res.body.order.totalCents).toBe(2999);
  });

  it("uses the price at the time of the order, not later changes", async () => {
    const res = await order(alice, [{ productId: mouse.id, quantity: 1 }]);
    await prisma.product.update({ where: { id: mouse.id }, data: { priceCents: 9999 } });

    const history = await request(app).get("/orders").set("Cookie", alice);
    expect(history.body.orders[0].id).toBe(res.body.order.id);
    expect(history.body.orders[0].items[0].unitPriceCents).toBe(2999);
  });

  it("rejects more than 2 of a product in one order", async () => {
    const res = await order(alice, [{ productId: mouse.id, quantity: 3 }]);
    expect(res.status).toBe(400);
    expect(await stockOf(mouse.id)).toBe(50);
  });

  it("rejects going over 2 of a product across orders", async () => {
    expect((await order(alice, [{ productId: mouse.id, quantity: 1 }])).status).toBe(201);
    expect((await order(alice, [{ productId: mouse.id, quantity: 1 }])).status).toBe(201);

    const third = await order(alice, [{ productId: mouse.id, quantity: 1 }]);
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe("PURCHASE_LIMIT");
    expect(third.body.error.details).toMatchObject({ limit: 2, alreadyBought: 2 });
    expect(await stockOf(mouse.id)).toBe(48);
    // The refused order left nothing behind.
    expect(await prisma.order.count()).toBe(2);
    expect(await prisma.orderItem.count()).toBe(2);
    expect(await prisma.stockMovement.count({ where: { reason: "ORDER" } })).toBe(2);
  });

  it("applies the limit per customer", async () => {
    await order(alice, [{ productId: mouse.id, quantity: 2 }]);
    const res = await order(bob, [{ productId: mouse.id, quantity: 2 }]);
    expect(res.status).toBe(201);
  });

  it("rejects an order when stock runs out, and changes nothing", async () => {
    await order(alice, [{ productId: hub.id, quantity: 2 }]);

    const res = await order(bob, [
      { productId: mouse.id, quantity: 1 },
      { productId: hub.id, quantity: 2 },
    ]);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("OUT_OF_STOCK");
    // The whole order rolled back, including the mouse.
    expect(await stockOf(mouse.id)).toBe(50);
    expect(await stockOf(hub.id)).toBe(1);
    expect(await prisma.order.count({ where: { user: { email: "bob@test.com" } } })).toBe(0);
    // Only Alice's order and its one item and movement exist.
    expect(await prisma.orderItem.count()).toBe(1);
    expect(await prisma.stockMovement.count({ where: { reason: "ORDER" } })).toBe(1);
  });

  it("gives 404 for an unknown product", async () => {
    const res = await order(alice, [{ productId: 99999, quantity: 1 }]);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("rejects invalid input", async () => {
    for (const items of [undefined, [], [{ productId: "1", quantity: 1 }],
      [{ productId: mouse.id, quantity: 1 }, { productId: mouse.id, quantity: 1 }]]) {
      const res = await order(alice, items);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it.each([0, -1, 1.5, "1", null])("rejects quantity %j (must be a whole number of 1 or more)", async (quantity) => {
    const res = await order(alice, [{ productId: mouse.id, quantity }]);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].path).toBe("items.0.quantity");
    expect(await stockOf(mouse.id)).toBe(50);
  });

  it("rejects admins (orders are for customers)", async () => {
    expect((await order(admin, [{ productId: mouse.id, quantity: 1 }])).status).toBe(403);
  });

  it("requires login", async () => {
    expect((await request(app).post("/orders").send({ items: [] })).status).toBe(401);
  });
});

describe("concurrency", () => {
  it("never lets one customer get more than 2 units, even with simultaneous orders", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => order(alice, [{ productId: mouse.id, quantity: 1 }])),
    );
    const statuses = results.map((r) => r.status).sort();

    expect(statuses).toEqual([201, 201, 409, 409, 409]);
    expect(await stockOf(mouse.id)).toBe(48);
    const owned = await prisma.orderItem.aggregate({
      where: { productId: mouse.id, order: { user: { email: "alice@test.com" } } },
      _sum: { quantity: true },
    });
    expect(owned._sum.quantity).toBe(2);
  });

  it("never sells more than the stock, even with simultaneous orders", async () => {
    // Hub has 3 in stock. Two customers each try to buy 2 at the same moment.
    const results = await Promise.all([
      order(alice, [{ productId: hub.id, quantity: 2 }]),
      order(bob, [{ productId: hub.id, quantity: 2 }]),
    ]);
    const statuses = results.map((r) => r.status).sort();

    expect(statuses).toEqual([201, 409]);
    expect(await stockOf(hub.id)).toBe(1);
  });
});

describe("GET /orders", () => {
  it("shows only the customer's own orders, newest first", async () => {
    const first = await order(alice, [{ productId: mouse.id, quantity: 1 }]);
    const second = await order(alice, [{ productId: hub.id, quantity: 1 }]);
    await order(bob, [{ productId: mouse.id, quantity: 1 }]);

    const res = await request(app).get("/orders").set("Cookie", alice);
    expect(res.status).toBe(200);
    expect(res.body.orders.map((o: { id: number }) => o.id)).toEqual([second.body.order.id, first.body.order.id]);
  });

  it("is empty for a new customer", async () => {
    const res = await request(app).get("/orders").set("Cookie", bob);
    expect(res.body.orders).toEqual([]);
  });
});
