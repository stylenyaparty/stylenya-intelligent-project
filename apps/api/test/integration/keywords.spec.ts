import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, seedAdmin, resetDatabase } from "../helpers.js";
import { prisma } from "../../src/infrastructure/db/prisma.js";

describe("Keywords API", () => {
    let app: FastifyInstance;
    let request: ReturnType<typeof supertest>;

    let cachedHeaders: { Authorization: string } | null = null;

    beforeAll(async () => {
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
            email: "stylenya.party@gmail.com",
            password: "D3s4rr0ll0",
        });

        const token = await getAuthToken(app, admin.email, admin.password);
        cachedHeaders = { Authorization: `Bearer ${token}` };
        return cachedHeaders;
    }

    async function createAutoJob(headers: { Authorization: string }) {
        await request
            .post("/keywords/seeds")
            .set(headers)
            .send({ terms: [`auto seed ${Date.now()}-${Math.random()}`] })
            .expect(201);

        const response = await request
            .post("/keywords/jobs")
            .set(headers)
            .send({
                mode: "AUTO",
                marketplace: "ETSY",
                language: "en",
                country: "us",
            })
            .expect(201);

        return response.body.job as { id: string };
    }

    it("creates seeds with normalization and dedupe", async () => {
        const headers = await authHeader();

        const response = await request
            .post("/keywords/seeds")
            .set(headers)
            .send({ terms: [" Party   Decorations ", "party decorations", "Gift Tags"] })
            .expect(201);

        expect(response.body.created).toHaveLength(2);
        expect(response.body.existing).toHaveLength(0);
        expect(response.body.created.map((seed: { term: string }) => seed.term)).toEqual(
            expect.arrayContaining(["party decorations", "gift tags"])
        );

        const second = await request
            .post("/keywords/seeds")
            .set(headers)
            .send({ terms: ["Party Decorations"] })
            .expect(201);

        expect(second.body.created).toHaveLength(0);
        expect(second.body.existing).toHaveLength(1);
        expect(second.body.existing[0].term).toBe("party decorations");
    });

    it("blocks AUTO/HYBRID job creation when no active seeds exist and exposes counts", async () => {
        const headers = await authHeader();

        await prisma.keywordSeed.deleteMany();

        const emptyCount = await request
            .get("/keyword-seeds/count")
            .set(headers)
            .expect(200);

        expect(emptyCount.body.count).toBe(0);

        const archivedSeed = await request
            .post("/keywords/seeds")
            .set(headers)
            .send({ terms: ["archived seed"] })
            .expect(201);

        const archivedId = archivedSeed.body.created[0].id as string;

        await request
            .patch(`/keywords/seeds/${archivedId}`)
            .set(headers)
            .send({ status: "ARCHIVED" })
            .expect(200);

        const archivedCount = await request
            .get("/keyword-seeds/count")
            .set(headers)
            .expect(200);

        expect(archivedCount.body.count).toBe(0);

        await request
            .post("/keywords/jobs")
            .set(headers)
            .send({
                mode: "AUTO",
                marketplace: "ETSY",
                language: "en",
                country: "us",
            })
            .expect(409)
            .then((response) => {
                expect(response.body.code).toBe("SEEDS_REQUIRED");
            });

        await request
            .post("/keywords/jobs")
            .set(headers)
            .send({
                mode: "HYBRID",
                marketplace: "ETSY",
                language: "en",
                country: "us",
                seedIds: [archivedId],
            })
            .expect(409)
            .then((response) => {
                expect(response.body.code).toBe("SEEDS_REQUIRED");
            });

        const customJob = await request
            .post("/keywords/jobs")
            .set(headers)
            .send({
                mode: "CUSTOM",
                marketplace: "ETSY",
                language: "en",
                country: "us",
                seedIds: [archivedId],
            })
            .expect(201);

        expect(customJob.body.job.mode).toBe("CUSTOM");

        await request
            .post("/keywords/seeds")
            .set(headers)
            .send({ terms: ["active seed"] })
            .expect(201);

        const activeCount = await request
            .get("/keyword-seeds/count")
            .set(headers)
            .expect(200);

        expect(activeCount.body.count).toBeGreaterThan(0);
    });

    it("creates a CUSTOM job with seed items", async () => {
        const headers = await authHeader();

        const seeds = await request
            .post("/keywords/seeds")
            .set(headers)
            .send({ terms: ["wedding favors", "bridal shower decor"] })
            .expect(201);

        const seedIds = [...seeds.body.created, ...seeds.body.existing].map(
            (seed: { id: string }) => seed.id
        );

        const response = await request
            .post("/keywords/jobs")
            .set(headers)
            .send({
                mode: "CUSTOM",
                marketplace: "ETSY",
                language: "en",
                country: "us",
                seedIds,
            })
            .expect(201);

        expect(response.body.job.mode).toBe("CUSTOM");
        expect(response.body.items).toHaveLength(2);
        expect(response.body.items[0].source).toBe("CUSTOM");
    });

    it("creates an AUTO job with generated items", async () => {
        const headers = await authHeader();

        await request
            .post("/keywords/seeds")
            .set(headers)
            .send({ terms: [`auto seed ${Date.now()}-${Math.random()}`] })
            .expect(201);

        const response = await request
            .post("/keywords/jobs")
            .set(headers)
            .send({
                mode: "AUTO",
                marketplace: "SHOPIFY",
                language: "en",
                country: "us",
            })
            .expect(201);

        expect(response.body.job.mode).toBe("AUTO");
        expect(response.body.items).toHaveLength(0);
    });

    it("stores google-ready fields for keyword jobs", async () => {
        const headers = await authHeader();

        await request
            .post("/keywords/seeds")
            .set(headers)
            .send({ terms: [`auto seed ${Date.now()}-${Math.random()}`] })
            .expect(201);

        const response = await request
            .post("/keywords/jobs")
            .set(headers)
            .send({
                mode: "AUTO",
                marketplace: "GOOGLE",
                language: "en",
                country: "us",
                maxResults: 12,
            })
            .expect(201);

        expect(response.body.job).toMatchObject({
            engine: "google",
            language: "en",
            country: "US",
            maxResults: 12,
            providerUsed: "TRENDS",
        });
    });

    it("creates a HYBRID job with seed items", async () => {
        const headers = await authHeader();

        const seeds = await request
            .post("/keywords/seeds")
            .set(headers)
            .send({ terms: ["Party Decorations Banner"] })
            .expect(201);

        const seedIds = [...seeds.body.created, ...seeds.body.existing].map(
            (seed: { id: string }) => seed.id
        );

        const response = await request
            .post("/keywords/jobs")
            .set(headers)
            .send({
                mode: "HYBRID",
                marketplace: "ETSY",
                language: "en",
                country: "us",
                seedIds,
            })
            .expect(201);

        const terms = response.body.items.map((item: { term: string }) => item.term);
        const uniqueTerms = new Set(terms);

        expect(response.body.items.length).toBe(seedIds.length);
        expect(uniqueTerms.size).toBe(response.body.items.length);
        expect(
            response.body.items.find(
                (item: { term: string; source: string }) =>
                    item.term === "party decorations banner" && item.source === "CUSTOM"
            )
        ).toBeTruthy();
    });

    it("promotes a keyword job item and dedupes signals", async () => {
        const headers = await authHeader();

        const seeds = await request
            .post("/keywords/seeds")
            .set(headers)
            .send({ terms: ["spring banner"] })
            .expect(201);

        const seedId = seeds.body.created[0].id as string;

        const customJob = await request
            .post("/keywords/jobs")
            .set(headers)
            .send({
                mode: "CUSTOM",
                marketplace: "GOOGLE",
                language: "en",
                country: "us",
                seedIds: [seedId],
            })
            .expect(201);

        const itemId = customJob.body.items[0].id as string;

        const first = await request
            .post(`/keywords/job-items/${itemId}/promote`)
            .set(headers)
            .send({})
            .expect(201);

        expect(first.body.promoted).toBe(true);
        expect(first.body.keyword).toBe(customJob.body.items[0].term);

        const second = await request
            .post(`/keywords/job-items/${itemId}/promote`)
            .set(headers)
            .send({})
            .expect(200);

        expect(second.body.signalId).toBe(first.body.signalId);
    });

    it("archives a job and hides it from the default list", async () => {
        const headers = await authHeader();

        const job = await createAutoJob(headers);

        await request
            .post(`/keywords/jobs/${job.id}/archive`)
            .set(headers)
            .send({})
            .expect(200);

        const list = await request
            .get("/keywords/jobs")
            .set(headers)
            .expect(200);

        expect(list.body.jobs.find((row: { id: string }) => row.id === job.id)).toBeFalsy();
    });

    it("lists archived jobs when status=archived and returns all jobs when status=all", async () => {
        const headers = await authHeader();

        const archivedJob = await createAutoJob(headers);
        await request
            .post(`/keywords/jobs/${archivedJob.id}/archive`)
            .set(headers)
            .send({})
            .expect(200);

        const activeJob = await createAutoJob(headers);

        const archivedList = await request
            .get("/keywords/jobs?status=archived")
            .set(headers)
            .expect(200);

        expect(
            archivedList.body.jobs.find((row: { id: string }) => row.id === archivedJob.id)
        ).toBeTruthy();

        const allList = await request
            .get("/keywords/jobs?status=all")
            .set(headers)
            .expect(200);

        const allIds = allList.body.jobs.map((row: { id: string }) => row.id);
        expect(allIds).toContain(archivedJob.id);
        expect(allIds).toContain(activeJob.id);
    });

    it("prevents double archive and restores archived jobs", async () => {
        const headers = await authHeader();

        const job = await createAutoJob(headers);

        await request
            .post(`/keywords/jobs/${job.id}/archive`)
            .set(headers)
            .send({})
            .expect(200);

        await request
            .post(`/keywords/jobs/${job.id}/archive`)
            .set(headers)
            .send({})
            .expect(409);

        await request
            .post(`/keywords/jobs/${job.id}/restore`)
            .set(headers)
            .send({})
            .expect(200);

        const list = await request
            .get("/keywords/jobs")
            .set(headers)
            .expect(200);

        expect(list.body.jobs.find((row: { id: string }) => row.id === job.id)).toBeTruthy();
    });

    it("returns 409 when restoring an active job", async () => {
        const headers = await authHeader();

        const job = await createAutoJob(headers);

        await request
            .post(`/keywords/jobs/${job.id}/restore`)
            .set(headers)
            .send({})
            .expect(409);
    });

    it("returns 409 when running an archived job", async () => {
        const headers = await authHeader();

        const job = await createAutoJob(headers);

        await request
            .post(`/keywords/jobs/${job.id}/archive`)
            .set(headers)
            .send({})
            .expect(200);

        await request
            .post(`/keywords/jobs/${job.id}/run`)
            .set(headers)
            .expect(409);
    });

    it("returns 409 when archiving a running job", async () => {
        const headers = await authHeader();

        const job = await createAutoJob(headers);
        await prisma.keywordJob.update({
            where: { id: job.id },
            data: { status: "RUNNING" },
        });

        await request
            .post(`/keywords/jobs/${job.id}/archive`)
            .set(headers)
            .send({})
            .expect(409);
    });
});
