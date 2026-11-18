import { hash } from "bcryptjs";
import { prisma } from "../src/db/client.js";

// Demo logins. The defaults are listed in the README so reviewers can log in.
// Override them in .env.
const users = [
  {
    email: "admin@example.com",
    password: process.env.SEED_ADMIN_PASSWORD ?? "Admin123!",
    role: "ADMIN",
  },
  {
    email: "alice@example.com",
    password: process.env.SEED_CUSTOMER_PASSWORD ?? "Customer123!",
    role: "CUSTOMER",
  },
  {
    email: "bob@example.com",
    password: process.env.SEED_CUSTOMER_PASSWORD ?? "Customer123!",
    role: "CUSTOMER",
  },
] as const;

const products = [
  {
    name: "Wireless Mouse",
    description: "Ergonomic 2.4GHz mouse",
    imageUrl: "/products/wireless-mouse.svg",
    priceCents: 2999,
    unitsInStock: 50,
  },
  {
    name: "Mechanical Keyboard",
    description: "Tenkeyless, brown switches",
    imageUrl: "/products/mechanical-keyboard.svg",
    priceCents: 8999,
    unitsInStock: 20,
  },
  // Low stock on purpose, to exercise the stock and 2-unit rules.
  {
    name: "USB-C Hub",
    description: "7-in-1 with HDMI and SD card reader",
    imageUrl: "/products/usb-c-hub.svg",
    priceCents: 4999,
    unitsInStock: 3,
  },
];

async function main() {
  // Hash outside the transaction, since bcrypt is slow on purpose.
  const hashed = await Promise.all(
    users.map(async (u) => ({
      email: u.email,
      role: u.role,
      passwordHash: await hash(u.password, 10),
    })),
  );

  await prisma.$transaction(async (tx) => {
    // Clear in foreign-key order so the seed can be re-run.
    await tx.orderItem.deleteMany();
    await tx.stockMovement.deleteMany();
    await tx.order.deleteMany();
    await tx.product.deleteMany();

    for (const u of hashed) {
      await tx.user.upsert({
        where: { email: u.email },
        update: { passwordHash: u.passwordHash, role: u.role },
        create: u,
      });
    }

    for (const p of products) {
      await tx.product.create({
        data: {
          ...p,
          stockMovements: {
            create: { quantity: p.unitsInStock, reason: "RESTOCK" },
          },
        },
      });
    }
  });

  console.log(`Seeded ${hashed.length} users and ${products.length} products.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
