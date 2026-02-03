import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, seedAdmin } from "../helpers.js";

describe("Dashboard KPIs API", () => {
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
            email: "stylenya.party@gmail.com",
            password: "D3s4rr0ll0",
        });

        const token = await getAuthToken(app, admin.email, admin.password);
        cachedHeaders = { Authorization: `Bearer ${token}` };
        return cachedHeaders;
    }

    it("returns numeric KPI fields and null productOfWeek", async () => {
        const headers = await authHeader();

        const response = await request
            .get("/dashboard/kpis")
            .set(headers)
            .expect(200);

        expect(response.body).toMatchObject({
            activeProducts: expect.any(Number),
            weeklyFocusItems: expect.any(Number),
            pendingDecisions: expect.any(Number),
            recentDecisions: expect.any(Number),
            productOfWeek: null,
        });
    });
});
