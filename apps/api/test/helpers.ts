import bcrypt from "bcryptjs";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/interfaces/http/app.js";
import { prisma } from "../src/infrastructure/db/prisma.js";

type SeedUserInput = {
    email: string;
    password: string;
    name?: string | null;
    role?: "ADMIN" | "USER";
};

export async function createTestServer() {
    const app = await createApp({ logger: false });
    await app.ready();
    return app;
}

export async function resetDatabase() {
    await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE "Decision", "DecisionLog", "SalesRecord", "Request", "Product", "Settings", "User" CASCADE;'
    );
}

export async function seedAdmin(app: FastifyInstance, overrides: Partial<SeedUserInput> = {}) {
    const payload = {
        email: overrides.email ?? "admin@example.com",
        password: overrides.password ?? "AdminPass123!",
        name: overrides.name ?? "Admin User",
    };

    await supertest(app.server).post("/v1/initial-admin").send(payload).expect(201);

    return payload;
}

export async function createUser(input: SeedUserInput) {
    const passwordHash = await bcrypt.hash(input.password, 10);
    return prisma.user.create({
        data: {
            email: input.email,
            name: input.name ?? null,
            role: input.role ?? "USER",
            passwordHash,
        },
    });
}

export async function getAuthToken(app: FastifyInstance, email: string, password: string) {
    const response = await supertest(app.server)
        .post("/v1/auth/login")
        .send({ email, password })
        .expect(200);

    return response.body.token as string;
}
