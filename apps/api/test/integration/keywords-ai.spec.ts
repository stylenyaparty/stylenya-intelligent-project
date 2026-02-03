import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, resetDatabase, seedAdmin } from "../helpers.js";

describe("Keyword AI Jobs", () => {
    let app: FastifyInstance;
    let request: ReturnType<typeof supertest>;

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
        const admin = await seedAdmin(app, {
            email: "stylenya.party@gmail.com",
            password: "D3s4rr0ll0",
        });
        const token = await getAuthToken(app, admin.email, admin.password);
        return { Authorization: `Bearer ${token}` };
    }

    it("creates an AI job with a topic", async () => {
        const headers = await authHeader();

        const response = await request
            .post("/keywords/jobs")
            .set(headers)
            .send({
                mode: "AI",
                marketplace: "ETSY",
                language: "en",
                country: "us",
                topic: "party decorations",
                maxResults: 5,
            })
            .expect(201);

        expect(response.body.job.mode).toBe("AI");
        expect(response.body.job.topic).toBe("party decorations");
        expect(response.body.job.maxResults).toBe(5);
    });

    it("rejects AI job creation without a topic", async () => {
        const headers = await authHeader();

        const response = await request
            .post("/keywords/jobs")
            .set(headers)
            .send({
                mode: "AI",
                marketplace: "ETSY",
                language: "en",
                country: "us",
            })
            .expect(400);

        expect(response.body.error).toBe("Topic is required for AI mode.");
    });

    it("runs an AI job and stores unique results", async () => {
        const headers = await authHeader();

        const job = await request
            .post("/keywords/jobs")
            .set(headers)
            .send({
                mode: "AI",
                marketplace: "SHOPIFY",
                language: "en",
                country: "us",
                topic: "custom candles",
                maxResults: 6,
            })
            .expect(201);

        const jobId = job.body.job.id;

        const run = await request
            .post(`/keywords/jobs/${jobId}/run`)
            .set(headers)
            .expect(200);

        expect(run.body.job.status).toBe("DONE");
        expect(run.body.items.length).toBeGreaterThan(0);
        expect(run.body.items.length).toBeLessThanOrEqual(6);
        expect(run.body.items.every((item: { source: string }) => item.source === "AI")).toBe(
            true
        );

        const terms = run.body.items.map((item: { term: string }) => item.term.toLowerCase());
        const uniqueTerms = new Set(terms);
        expect(uniqueTerms.size).toBe(terms.length);
    });
});
