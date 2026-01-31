import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, seedAdmin } from "../helpers.js";


describe("Decisions API", () => {
    let app: FastifyInstance;
    let request: ReturnType<typeof supertest>;
    let cachedHeaders: { Authorization: string } | null = null;

    beforeAll(async () => {
        app = await createTestServer();
        request = supertest(app.server);
    });

    afterAll(async () => {
        await app.close();
    });

    async function authHeader() {
        if (cachedHeaders) return cachedHeaders;

        const admin = await seedAdmin(app, {
            email: "decisions-admin@example.com",
            password: "AdminPass123!",
        });

        const token = await getAuthToken(app, admin.email, admin.password);
        cachedHeaders = { Authorization: `Bearer ${token}` };
        return cachedHeaders;
    }

    it("creates a planned decision from weekly focus payload", async () => {
        const headers = await authHeader();

        const response = await request
            .post("/v1/decisions")
            .set(headers)
            .send({
                actionType: "PROMOTE",
                targetType: "KEYWORD",
                targetId: "birthday banner",
                title: "Promote \"Birthday Banner\"",
                rationale: "Promoted keyword is trending",
                priorityScore: 92,
                sources: [{ keyword: "birthday banner", signalId: "sig-1" }],
            })
            .expect(201);

        expect(response.body.ok).toBe(true);
        expect(response.body.decision).toMatchObject({
            actionType: "PROMOTE",
            status: "PLANNED",
            targetType: "KEYWORD",
            targetId: "birthday banner",
            title: "Promote \"Birthday Banner\"",
            rationale: "Promoted keyword is trending",
            priorityScore: 92,
        });
    });

    it("lists decisions including newly created entries", async () => {
        const headers = await authHeader();

        const created = await request
            .post("/v1/decisions")
            .set(headers)
            .send({
                actionType: "PAUSE",
                targetType: "PRODUCT",
                targetId: "product-123",
                title: "Pause low-performing SKU",
                rationale: "Sales dropped below threshold",
                priorityScore: 30,
            })
            .expect(201);

        const response = await request
            .get("/v1/decisions?limit=10")
            .set(headers)
            .expect(200);

        expect(response.body.ok).toBe(true);
        const ids = response.body.decisions.map((d: { id: string }) => d.id);
        expect(ids).toContain(created.body.decision.id);
    });

    it("updates decision status", async () => {
        const headers = await authHeader();

        const created = await request
            .post("/v1/decisions")
            .set(headers)
            .send({
                actionType: "OPTIMIZE",
                targetType: "PRODUCT",
                targetId: "product-456",
                title: "Optimize listing title",
                rationale: "Missing keyword in title",
                priorityScore: 70,
            })
            .expect(201);

        const response = await request
            .patch(`/v1/decisions/${created.body.decision.id}`)
            .set(headers)
            .send({ status: "EXECUTED" })
            .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.decision.status).toBe("EXECUTED");
    });
});
