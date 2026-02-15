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
    isReviewer?: boolean;
    archivedAt?: Date | null;
};

export const API_PREFIX = "/v1";

export function apiPath(path: string) {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    if (normalized === API_PREFIX || normalized.startsWith(`${API_PREFIX}/`)) {
        return normalized;
    }
    return `${API_PREFIX}${normalized}`;
}

export async function createTestServer() {
    const app = await createApp();
    await app.ready();
    return app;
}

export async function resetDatabase() {
    await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE "ProductTypeDefinition", "KeywordSignal", "SignalBatch", "DecisionDraft", "WeeklyFocus", "PromotedKeywordSignal", "KeywordJobItem", "KeywordJob", "KeywordSeed", "Decision", "DecisionLog", "SalesRecord", "Request", "Product", "Settings", "User" CASCADE;'
    );
}

export async function seedAdmin(app: FastifyInstance, overrides: Partial<SeedUserInput> = {}) {
    const payload = {
        email: overrides.email ?? "admin@example.com",
        password: overrides.password ?? "AdminPass123!",
        name: overrides.name ?? "Admin User",
    };

    const res = await supertest(app.server).post(apiPath("/initial-admin")).send(payload);

    if (![201, 409].includes(res.status)) {
        throw new Error(`seedAdmin failed: ${res.status} ${JSON.stringify(res.body)}`);
    }

    return payload;
}

export async function createUser(input: SeedUserInput) {
    const passwordHash = await bcrypt.hash(input.password, 10);
    return prisma.user.create({
        data: {
            email: input.email,
            name: input.name ?? null,
            role: input.role ?? "USER",
            isReviewer: input.isReviewer ?? false,
            archivedAt: input.archivedAt ?? null,
            passwordHash,
        },
    });
}

export async function getAuthToken(app: FastifyInstance, email: string, password: string) {
    const response = await supertest(app.server)
        .post(apiPath("/auth/login"))
        .send({ email, password })
        .expect(200);

    return response.body.token as string;
}
