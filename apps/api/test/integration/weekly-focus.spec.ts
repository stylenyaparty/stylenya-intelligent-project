import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../src/infrastructure/db/prisma.js";
import { createTestServer, getAuthToken, seedAdmin, apiPath } from "../helpers.js";

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
            email: "stylenya.party@gmail.com",
            password: "D3s4rr0ll0",
        });

        const token = await getAuthToken(app, admin.email, admin.password);
        cachedHeaders = { Authorization: `Bearer ${token}` };
        return cachedHeaders;
    }

    it("returns empty list when no promoted signals exist", async () => {
        const headers = await authHeader();

        const response = await request
            .get(apiPath("/weekly-focus?limit=7"))
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

        const seeds = await request
            .post(apiPath("/keywords/seeds"))
            .set(headers)
            .send({ terms: ["birthday banner"] })
            .expect(201);

        const seedId = seeds.body.created[0].id as string;

        const job = await request
            .post(apiPath("/keywords/jobs"))
            .set(headers)
            .send({
                mode: "CUSTOM",
                marketplace: "GOOGLE",
                language: "en",
                country: "US",
                seedIds: [seedId],
                providerUsed: "TRENDS",
            })
            .expect(201);

        const keywordItem = job.body.items[0];

        await request
            .post(apiPath(`/keywords/job-items/${keywordItem.id}/promote`))
            .set(headers)
            .send({})
            .expect(201);

        const response = await request
            .get(apiPath("/weekly-focus?limit=7"))
            .set(headers)
            .expect(200);

        expect(response.body.items.length).toBeGreaterThan(0);
        expect(response.body.items[0]).toMatchObject({
            actionType: "PROMOTE",
            targetType: "PRODUCT",
            targetId: product.id,
        });
        expect(response.body.items[0].dedupeKey).toEqual(expect.any(String));
    });

    it("skips competition penalty when competitionScore is null", async () => {
        const headers = await authHeader();

        const job = await prisma.keywordJob.create({
            data: {
                mode: "CUSTOM",
                marketplace: "GOOGLE",
                language: "en",
                engine: "google",
                country: "US",
                niche: "party decorations",
                maxResults: 10,
                providerUsed: "TRENDS",
                paramsJson: {},
                status: "DONE",
            },
        });

        const item = await prisma.keywordJobItem.create({
            data: {
                jobId: job.id,
                term: "trend keyword",
                source: "CUSTOM",
                status: "DONE",
                resultJson: { interestScore: 80 },
            },
        });

        await request
            .post(apiPath(`/keywords/job-items/${item.id}/promote`))
            .set(headers)
            .send({})
            .expect(201);

        const response = await request
            .get(apiPath("/weekly-focus?limit=7"))
            .set(headers)
            .expect(200);

        expect(response.body.items[0]).toMatchObject({
            actionType: "CREATE",
            targetType: "KEYWORD",
            priorityScore: 100,
        });
        expect(response.body.items[0].rationale).toContain("Competition unavailable");
    });
});
