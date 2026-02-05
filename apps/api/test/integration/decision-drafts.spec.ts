import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../src/infrastructure/db/prisma.js";
import { resetLLMProviderCache } from "../../src/modules/llm/get-llm-provider.js";
import { getDecisionDateRange } from "../../src/modules/decisions/decision-date-range.js";
import { createTestServer, getAuthToken, resetDatabase, seedAdmin } from "../helpers.js";

describe("Decision Drafts API", () => {
    let app: FastifyInstance;
    let request: ReturnType<typeof supertest>;
    let token: string;

    beforeAll(async () => {
        await resetDatabase();
        app = await createTestServer();
        request = supertest(app.server);

        const admin = await seedAdmin(app, {
            email: "stylenya.party@gmail.com",
            password: "D3s4rr0ll0",
        });
        token = await getAuthToken(app, admin.email, admin.password);
    });

    beforeEach(async () => {
        await resetDatabase();
        resetLLMProviderCache();
        delete process.env.OPENAI_API_KEY;
    });

    afterAll(async () => {
        await app.close();
    });

    async function seedSignalBatch() {
        const batch = await prisma.signalBatch.create({
            data: {
                source: "TEST",
                status: "READY",
                rowCount: 2,
            },
        });

        const signalOne = await prisma.keywordSignal.create({
            data: {
                batchId: batch.id,
                term: "handmade candle",
                termNormalized: "handmade candle",
                source: "GKP",
            },
        });

        const signalTwo = await prisma.keywordSignal.create({
            data: {
                batchId: batch.id,
                term: "gift wrap",
                termNormalized: "gift wrap",
                source: "GKP",
            },
        });

        return { batch, signals: [signalOne, signalTwo] };
    }

    it("rejects draft generation without auth", async () => {
        await request.post("/v1/decision-drafts/generate").send({}).expect(401);
    });

    it("guards against generation without signals", async () => {
        process.env.LLM_PROVIDER = "mock";

        const response = await request
            .post("/v1/decision-drafts/generate")
            .set({ Authorization: `Bearer ${token}` })
            .send({ seeds: ["candle"] })
            .expect(400);

        expect(response.body.code).toBe("SIGNALS_REQUIRED");
    });

    it("generates drafts with the mock provider and persists them", async () => {
        process.env.LLM_PROVIDER = "mock";
        const { batch, signals } = await seedSignalBatch();

        const response = await request
            .post("/v1/decision-drafts/generate")
            .set({ Authorization: `Bearer ${token}` })
            .send({ batchId: batch.id, seeds: ["candle"], context: "Holiday upsell" })
            .expect(201);

        expect(response.body.drafts.length).toBeGreaterThan(0);
        expect(response.body.drafts[0].signalIds).toEqual(
            expect.arrayContaining([signals[0].id, signals[1].id])
        );

        const stored = await prisma.decisionDraft.findMany();
        expect(stored.length).toBeGreaterThan(0);
        expect(stored[0].status).toBe("NEW");
    });

    it("lists drafts for today by default", async () => {
        const range = getDecisionDateRange({ now: new Date() });
        expect(range).toBeTruthy();
        if (!range) return;

        const yesterday = new Date(range.start.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayRange = getDecisionDateRange({
            date: new Intl.DateTimeFormat("en-CA", {
                timeZone: "America/New_York",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            }).format(yesterday),
        });
        expect(yesterdayRange).toBeTruthy();
        if (!yesterdayRange) return;

        await prisma.decisionDraft.create({
            data: {
                createdDate: range.start,
                title: "Today draft",
                rationale: "Based on signals",
                recommendedActions: ["Action"],
                confidence: 55,
                status: "NEW",
                signalIds: ["sig-1"],
            },
        });

        await prisma.decisionDraft.create({
            data: {
                createdDate: yesterdayRange.start,
                title: "Yesterday draft",
                rationale: "Older",
                recommendedActions: ["Action"],
                confidence: 40,
                status: "NEW",
                signalIds: ["sig-2"],
            },
        });

        const response = await request
            .get("/v1/decision-drafts")
            .set({ Authorization: `Bearer ${token}` })
            .expect(200);

        const titles = response.body.drafts.map((draft: { title: string }) => draft.title);
        expect(titles).toContain("Today draft");
        expect(titles).not.toContain("Yesterday draft");
    });

    it("dismisses a draft", async () => {
        const range = getDecisionDateRange({ now: new Date() });
        expect(range).toBeTruthy();
        if (!range) return;

        const draft = await prisma.decisionDraft.create({
            data: {
                createdDate: range.start,
                title: "Dismiss draft",
                rationale: "Test",
                recommendedActions: ["Action"],
                confidence: 45,
                status: "NEW",
                signalIds: ["sig-1"],
            },
        });

        const dismissed = await request
            .post(`/v1/decision-drafts/${draft.id}/dismiss`)
            .set({ Authorization: `Bearer ${token}` })
            .send({})
            .expect(200);

        expect(dismissed.body.draft.status).toBe("DISMISSED");
    });

    it("promotes a draft into a decision", async () => {
        const range = getDecisionDateRange({ now: new Date() });
        expect(range).toBeTruthy();
        if (!range) return;

        const draft = await prisma.decisionDraft.create({
            data: {
                createdDate: range.start,
                title: "Promote draft",
                rationale: "Test",
                recommendedActions: ["Action"],
                confidence: 85,
                status: "NEW",
                signalIds: ["sig-1"],
            },
        });

        const promoted = await request
            .post(`/v1/decision-drafts/${draft.id}/promote`)
            .set({ Authorization: `Bearer ${token}` })
            .send({})
            .expect(200);

        expect(promoted.body.draft.status).toBe("PROMOTED");
        expect(promoted.body.decision.id).toBeTruthy();

        const decision = await prisma.decision.findUnique({
            where: { id: promoted.body.decision.id },
        });
        expect(decision).not.toBeNull();
    });

    it("enforces traceability on promotion", async () => {
        const range = getDecisionDateRange({ now: new Date() });
        expect(range).toBeTruthy();
        if (!range) return;

        const draft = await prisma.decisionDraft.create({
            data: {
                createdDate: range.start,
                title: "Untraceable draft",
                rationale: "Missing signals",
                recommendedActions: ["Action"],
                confidence: 22,
                status: "NEW",
                signalIds: [],
            },
        });

        const response = await request
            .post(`/v1/decision-drafts/${draft.id}/promote`)
            .set({ Authorization: `Bearer ${token}` })
            .send({})
            .expect(409);

        expect(response.body.code).toBe("TRACEABILITY_REQUIRED");
    });
});
