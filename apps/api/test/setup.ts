import { execSync } from "node:child_process";
import { beforeAll, beforeEach, afterAll } from "vitest";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env.test") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error(
        "DATABASE_URL is not set. Create an apps/api/.env.test file with a dedicated test database URL."
    );
}

if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "test-jwt-secret";
}

let prisma: typeof import("../src/infrastructure/db/prisma.js")["prisma"];
let resetDatabase: typeof import("./helpers.js")["resetDatabase"];

beforeAll(async () => {
    prisma = (await import("../src/infrastructure/db/prisma.js")).prisma;
    resetDatabase = (await import("./helpers.js")).resetDatabase;

    const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");
    const prismaVersion = "6.19.2";
    execSync(
        `npx prisma@${prismaVersion} migrate reset --force --skip-seed --schema "${schemaPath}"`,
        {
        stdio: "inherit",
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, DATABASE_URL: databaseUrl },
        }
    );
});

beforeEach(async () => {
    await resetDatabase();
});

afterAll(async () => {
    if (prisma) {
        await prisma.$disconnect();
    }
});
