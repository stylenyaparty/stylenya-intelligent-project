import { execSync } from "node:child_process";
import dotenv from "dotenv";
import { beforeAll, beforeEach, afterAll } from "vitest";
import { resetDb } from "./reset-db.js";
import { prisma } from "../src/db/prisma.js";
import { memoryCache } from "../src/cache/memory.cache.js";

dotenv.config({ path: ".env.test", override: true });
process.env.NODE_ENV = "test";

beforeAll(async () => {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: process.env,
  });
  await resetDb();
});

beforeEach(async () => {
  memoryCache.clear();
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});
