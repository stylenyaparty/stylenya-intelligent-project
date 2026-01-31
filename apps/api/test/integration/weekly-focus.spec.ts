import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../src/infrastructure/db/prisma.js";
import { createTestServer, getAuthToken, seedAdmin } from "../helpers.js";

describe("Weekly Focus API", () => {
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
            email: "admin-weekly@example.com",
            password: "AdminPass123!",
        });

        const token = await getAuthToken(app, admin.email, admin.password);
        cachedHeaders = { Authorization: `Bearer ${token}` };
        return cachedHeaders;
    }

    it("returns empty list when no promoted signals exist", async () => {
        const headers = await authHeader();

        const response = await request
            .get("/v1/weekly-focus?limit=7")
            .set(headers)
            .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.items).toEqual([]);
    });

    it("generates action suggestions from promoted signals", async () => {
        const headers = await authHeader();

        const product = await prisma.product.create({
            data: {
                name: "Birthday Banner Deluxe",
                productSource: "SHOPIFY",
                productType: "banner",
                shopifyProductId: "shopify-123",
            },
        });

        const job = await request
            .post("/v1/keywords/jobs")
            .set(headers)
            .send({
                mode: "AUTO",
                marketplace: "GOOGLE",
                language: "en",
                country: "US",
                params: { occasion: "birthday", productType: "banner" },
            })
            .expect(201);

        const keywordItem = job.body.items.find(
            (item: { term: string }) => item.term === "birthday banner"
        );

        expect(keywordItem).toBeTruthy();

        await request
            .post(`/v1/keywords/job-items/${keywordItem.id}/promote`)
            .set(headers)
            .send({})
            .expect(201);

        const response = await request
            .get("/v1/weekly-focus?limit=7")
            .set(headers)
            .expect(200);

        expect(response.body.items.length).toBeGreaterThan(0);
        expect(response.body.items[0]).toMatchObject({
            actionType: "PROMOTE",
            targetType: "PRODUCT",
            targetId: product.id,
        });
    });
});
