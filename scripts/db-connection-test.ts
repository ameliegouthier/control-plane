#!/usr/bin/env tsx
/**
 * Database connection test using Prisma Client
 *
 * 1. Creates a new User with email and name
 * 2. Fetches the created user
 * 3. Logs the result
 *
 * Usage: npm run db:test-connection
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const testEmail = `test-${Date.now()}@example.com`;
  const testName = "Test User";

  console.log("Creating user...");
  const created = await prisma.user.create({
    data: {
      email: testEmail,
      name: testName,
    },
  });
  console.log("Created user:", created);

  console.log("\nFetching user by id...");
  const fetched = await prisma.user.findUnique({
    where: { id: created.id },
  });
  console.log("Fetched user:", fetched);

  // Clean up: delete test user
  await prisma.user.delete({ where: { id: created.id } });
  console.log("\nTest user removed. Database connection OK.");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
