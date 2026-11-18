import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/db/client.js";
import { createProduct, createUser, loginCookie, resetDb } from "./helpers.js";

let admin: string;
let customer: string;
let mouseId: number;

beforeEach(async () => {
  await resetDb();
  await createUser("admin@test.com", "ADMIN");
  await createUser("customer@test.com", "CUSTOMER");
  admin = await loginCookie("admin@test.com");
  customer = await loginCookie("customer@test.com");

  mouseId = (await createProduct({ name: "Mouse", priceCents: 2999, unitsInStock: 5 })).id;
  await createProduct({ name: "Sold out thing", priceCents: 100, unitsInStock: 0 });
});

afterAll(() => prisma.$disconnect());

describe("GET /products", () => {
  it("shows customers only products in stock, with current prices", async () => {
    const res = await request(app).get("/products").set("Cookie", customer);
    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([
      { id: mouseId, name: "Mouse", description: null, priceCents: 2999, unitsInStock: 5 },
    ]);
  });

  it("shows admins sold-out products too", async () => {
    const res = await request(app).get("/products").set("Cookie", admin);
    expect(res.body.products.map((p: { name: string }) => p.name)).toEqual(["Mouse", "Sold out thing"]);
  });

  it("requires login", async () => {
    expect((await request(app).get("/products")).status).toBe(401);
  });
});

describe("admin endpoints reject customers", () => {
  it.each([
    ["POST", "/products", { name: "X", priceCents: 100 }],
    ["PATCH", "/products/1/price", { priceCents: 100 }],
    ["POST", "/products/1/stock", { quantity: 5, reason: "RESTOCK" }],
  ] as const)("%s %s gives 403", async (method, path, body) => {
    const req = method === "POST" ? request(app).post(path) : request(app).patch(path);
    const res = await req.set("Cookie", customer).send(body);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("POST /products", () => {
  it("creates a product and logs its starting stock", async () => {
    const res = await request(app)
      .post("/products")
      .set("Cookie", admin)
      .send({ name: "  Keyboard ", priceCents: 8999, unitsInStock: 10 });

    expect(res.status).toBe(201);
    expect(res.body.product).toMatchObject({ name: "Keyboard", priceCents: 8999, unitsInStock: 10 });

    const movements = await prisma.stockMovement.findMany({ where: { productId: res.body.product.id } });
    expect(movements).toMatchObject([{ quantity: 10, reason: "RESTOCK" }]);
  });

  it("rejects invalid input", async () => {
    for (const body of [{}, { name: "X", priceCents: -1 }, { name: "X", priceCents: 9.99 }, { name: "", priceCents: 100 }]) {
      const res = await request(app).post("/products").set("Cookie", admin).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("PATCH /products/:id/price", () => {
  it("updates the price", async () => {
    const res = await request(app).patch(`/products/${mouseId}/price`).set("Cookie", admin).send({ priceCents: 1999 });
    expect(res.status).toBe(200);
    expect(res.body.product.priceCents).toBe(1999);
  });

  it("gives 404 for an unknown product", async () => {
    const res = await request(app).patch("/products/99999/price").set("Cookie", admin).send({ priceCents: 1999 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("gives 400 for a non-numeric id", async () => {
    const res = await request(app).patch("/products/abc/price").set("Cookie", admin).send({ priceCents: 1999 });
    expect(res.status).toBe(400);
  });
});

describe("POST /products/:id/stock", () => {
  it("adds stock and logs the movement", async () => {
    const res = await request(app)
      .post(`/products/${mouseId}/stock`)
      .set("Cookie", admin)
      .send({ quantity: 10, reason: "RESTOCK" });
    expect(res.status).toBe(200);
    expect(res.body.product.unitsInStock).toBe(15);

    const last = await prisma.stockMovement.findFirst({ where: { productId: mouseId }, orderBy: { id: "desc" } });
    expect(last).toMatchObject({ quantity: 10, reason: "RESTOCK" });
  });

  it("removes stock with an adjustment", async () => {
    const res = await request(app)
      .post(`/products/${mouseId}/stock`)
      .set("Cookie", admin)
      .send({ quantity: -2, reason: "ADJUSTMENT" });
    expect(res.body.product.unitsInStock).toBe(3);
  });

  it("never lets stock go below 0", async () => {
    const res = await request(app)
      .post(`/products/${mouseId}/stock`)
      .set("Cookie", admin)
      .send({ quantity: -6, reason: "ADJUSTMENT" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect((await prisma.product.findUnique({ where: { id: mouseId } }))!.unitsInStock).toBe(5);
  });

  it("rejects a restock that removes stock", async () => {
    const res = await request(app)
      .post(`/products/${mouseId}/stock`)
      .set("Cookie", admin)
      .send({ quantity: -1, reason: "RESTOCK" });
    expect(res.status).toBe(400);
  });
});
