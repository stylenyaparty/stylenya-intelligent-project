import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, seedAdmin, resetDatabase } from "../helpers.js";

describe("Keywords API", () => {
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
            email: "admin@example.com",
            password: "AdminPass123!",
        });

        const token = await getAuthToken(app, admin.email, admin.password);
        cachedHeaders = { Authorization: `Bearer ${token}` };
        return cachedHeaders;
    }

    it("creates seeds with normalization and dedupe", async () => {
        const headers = await authHeader();

        const response = await request
            .post("/v1/keywords/seeds")
            .set(headers)
            .send({ terms: [" Party   Decorations ", "party decorations", "Gift Tags"] })
            .expect(201);

        expect(response.body.created).toHaveLength(2);
        expect(response.body.existing).toHaveLength(0);
        expect(response.body.created.map((seed: { term: string }) => seed.term)).toEqual(
            expect.arrayContaining(["party decorations", "gift tags"])
        );

        const second = await request
            .post("/v1/keywords/seeds")
            .set(headers)
            .send({ terms: ["Party Decorations"] })
            .expect(201);

        expect(second.body.created).toHaveLength(0);
        expect(second.body.existing).toHaveLength(1);
        expect(second.body.existing[0].term).toBe("party decorations");
    });

    it("creates a CUSTOM job with seed items", async () => {
        const headers = await authHeader();

        const seeds = await request
            .post("/v1/keywords/seeds")
            .set(headers)
            .send({ terms: ["wedding favors", "bridal shower decor"] })
            .expect(201);

        const seedIds = [...seeds.body.created, ...seeds.body.existing].map(
            (seed: { id: string }) => seed.id
        );

        const response = await request
            .post("/v1/keywords/jobs")
            .set(headers)
            .send({
                mode: "CUSTOM",
                marketplace: "ETSY",
                language: "EN",
                seedIds,
            })
            .expect(201);

        expect(response.body.job.mode).toBe("CUSTOM");
        expect(response.body.items).toHaveLength(2);
        expect(response.body.items[0].source).toBe("CUSTOM");
    });

    it("creates an AUTO job with generated items", async () => {
        const headers = await authHeader();

        const response = await request
            .post("/v1/keywords/jobs")
            .set(headers)
            .send({
                mode: "AUTO",
                marketplace: "SHOPIFY",
                language: "EN",
                params: { occasion: "birthday", productType: "banner", audience: "kids" },
            })
        console.log("AUTO job status/body:", response.status, response.body);
        //.expect(201);
            expect(response.status).toBe(201);

        expect(response.body.job.mode).toBe("AUTO");
        expect(response.body.items.length).toBeGreaterThan(0);
        expect(response.body.items.every((item: { source: string }) => item.source === "AUTO")).toBe(true);
    });

    it("creates a HYBRID job with deduped items", async () => {
        const headers = await authHeader();

        const seeds = await request
            .post("/v1/keywords/seeds")
            .set(headers)
            .send({ terms: ["Party Decorations Banner"] })
            .expect(201);

        const seedIds = [...seeds.body.created, ...seeds.body.existing].map(
            (seed: { id: string }) => seed.id
        );

        const response = await request
            .post("/v1/keywords/jobs")
            .set(headers)
            .send({
                mode: "HYBRID",
                marketplace: "ETSY",
                language: "EN",
                niche: "party decorations",
                params: { productType: "banner" },
                seedIds,
            })
        console.log("HYBRID status/body:", response.status, response.body);
        expect(response.status).toBe(201);
           // .expect(201);

        const terms = response.body.items.map((item: { term: string }) => item.term);
        const uniqueTerms = new Set(terms);

        expect(response.body.items.length).toBe(6);
        expect(uniqueTerms.size).toBe(response.body.items.length);
        expect(
            response.body.items.find(
                (item: { term: string; source: string }) =>
                    item.term === "party decorations banner" && item.source === "CUSTOM"
            )
        ).toBeTruthy();
    });

    it("runs a job and stores results deterministically", async () => {
        const headers = await authHeader();

        const job = await request
            .post("/v1/keywords/jobs")
            .set(headers)
            .send({
                mode: "AUTO",
                marketplace: "GOOGLE",
                language: "ES",
                params: { occasion: "navidad", productType: "ornamentos" },
            })
            .expect(201);

        const jobId = job.body.job.id;

        const run = await request
            .post(`/v1/keywords/jobs/${jobId}/run`)
            .set(headers)
            .expect(200);

        expect(run.body.job.status).toBe("DONE");
        expect(run.body.items[0].status).toBe("DONE");
        expect(run.body.items[0].resultJson).toMatchObject({
            summary: expect.any(String),
            interestScore: expect.any(Number),
            competitionScore: expect.any(Number),
            relatedKeywords: expect.any(Array),
        });

        const rerun = await request
            .post(`/v1/keywords/jobs/${jobId}/run`)
            .set(headers)
            .expect(200);

        expect(rerun.body.job.status).toBe("DONE");
        expect(rerun.body.items).toEqual(run.body.items);
    });
});
