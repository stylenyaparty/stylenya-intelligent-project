import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, resetDatabase, seedAdmin } from "../helpers.js";

describe("LLM API", () => {
    let app: FastifyInstance;
    let request: ReturnType<typeof supertest>;
    let cachedHeaders: { Authorization: string } | null = null;

    beforeAll(async () => {
        process.env.LLM_PROVIDER = "mock";
        await resetDatabase();
        app = await createTestServer();
        request = supertest(app.server);
    });

    afterAll(async () => {
        await app.close();
    });

    async function authHeader() {
        if (cachedHeaders) return cachedHeaders;

        const admin = await seedAdmin(app, {
            email: "admin@example.com",
            password: "AdminPass123!",
        });
        const token = await getAuthToken(app, admin.email, admin.password);
        cachedHeaders = { Authorization: `Bearer ${token}` };
        return cachedHeaders;
    }

    it("returns keyword suggestions", async () => {
        const headers = await authHeader();
        const response = await request
            .post("/v1/ai/suggest-keywords")
            .set(headers)
            .send({ topic: "party decorations", max: 10 })
            .expect(200);

        expect(response.body.ok).toBe(true);
        expect(Array.isArray(response.body.keywords)).toBe(true);
        expect(response.body.keywords.length).toBeGreaterThan(0);
        expect(response.body.keywords.length).toBeLessThanOrEqual(10);
    });

    it("rejects missing topic", async () => {
        const headers = await authHeader();
        const response = await request
            .post("/v1/ai/suggest-keywords")
            .set(headers)
            .send({ max: 10 })
            .expect(400);

        expect(response.body.error).toBe("Invalid request");
    });

    it("rejects max above limit", async () => {
        const headers = await authHeader();
        const response = await request
            .post("/v1/ai/suggest-keywords")
            .set(headers)
            .send({ topic: "party decorations", max: 100 })
            .expect(400);

        expect(response.body.error).toBe("Invalid request");
    });

    it("returns deterministic suggestions", async () => {
        const headers = await authHeader();
        const first = await request
            .post("/v1/ai/suggest-keywords")
            .set(headers)
            .send({ topic: "party decorations", max: 10 })
            .expect(200);

        const second = await request
            .post("/v1/ai/suggest-keywords")
            .set(headers)
            .send({ topic: "party decorations", max: 10 })
            .expect(200);

        expect(first.body.keywords).toEqual(second.body.keywords);
    });
});
