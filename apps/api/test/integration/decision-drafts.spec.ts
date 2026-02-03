import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../src/infrastructure/db/prisma.js";
import { resetLLMProviderCache } from "../../src/modules/llm/get-llm-provider.js";
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

    it("rejects draft generation without auth", async () => {
        await request
            .post("/v1/weekly-focus/fake-id/drafts/generate")
            .send({})
            .expect(401);
    });

    it("returns LLM_NOT_CONFIGURED when disabled", async () => {
        process.env.LLM_PROVIDER = "disabled";

        await prisma.product.create({
            data: {
                name: "Seasonal Candle",
                productSource: "SHOPIFY",
                productType: "CANDLE",
                status: "ACTIVE",
                seasonality: "NONE",
            },
        });

        const weeklyFocus = await request
            .get("/v1/weekly-focus?limit=3")
            .set({ Authorization: `Bearer ${token}` })
            .expect(200);

        const response = await request
            .post(`/v1/weekly-focus/${weeklyFocus.body.weeklyFocusId}/drafts/generate`)
            .set({ Authorization: `Bearer ${token}` })
            .send({ maxDrafts: 2 })
            .expect(400);

        expect(response.body.code).toBe("LLM_NOT_CONFIGURED");
    });

    it("returns INSUFFICIENT_CONTEXT when no real inputs exist", async () => {
        process.env.LLM_PROVIDER = "mock";

        const weeklyFocus = await request
            .get("/v1/weekly-focus?limit=3")
            .set({ Authorization: `Bearer ${token}` })
            .expect(200);

        const response = await request
            .post(`/v1/weekly-focus/${weeklyFocus.body.weeklyFocusId}/drafts/generate`)
            .set({ Authorization: `Bearer ${token}` })
            .send({})
            .expect(409);

        expect(response.body.code).toBe("INSUFFICIENT_CONTEXT");
    });

    it("generates drafts with the mock provider and persists them", async () => {
        process.env.LLM_PROVIDER = "mock";

        await prisma.product.create({
            data: {
                name: "Handmade Tote",
                productSource: "ETSY",
                productType: "BAG",
                status: "ACTIVE",
                seasonality: "NONE",
            },
        });

        const weeklyFocus = await request
            .get("/v1/weekly-focus?limit=3")
            .set({ Authorization: `Bearer ${token}` })
            .expect(200);

        const response = await request
            .post(`/v1/weekly-focus/${weeklyFocus.body.weeklyFocusId}/drafts/generate`)
            .set({ Authorization: `Bearer ${token}` })
            .send({ maxDrafts: 1 })
            .expect(201);

        expect(response.body.drafts.length).toBeGreaterThan(0);

        const stored = await prisma.decisionDraft.findMany();
        expect(stored.length).toBeGreaterThan(0);
        expect(stored[0].status).toBe("ACTIVE");
    });

    it("dismisses a draft", async () => {
        process.env.LLM_PROVIDER = "mock";

        await prisma.product.create({
            data: {
                name: "Gift Wrap Kit",
                productSource: "SHOPIFY",
                productType: "ACCESSORY",
                status: "ACTIVE",
                seasonality: "NONE",
            },
        });

        const weeklyFocus = await request
            .get("/v1/weekly-focus?limit=3")
            .set({ Authorization: `Bearer ${token}` })
            .expect(200);

        const generated = await request
            .post(`/v1/weekly-focus/${weeklyFocus.body.weeklyFocusId}/drafts/generate`)
            .set({ Authorization: `Bearer ${token}` })
            .send({ maxDrafts: 1 })
            .expect(201);

        const draftId = generated.body.drafts[0].id as string;

        const dismissed = await request
            .post(`/v1/decision-drafts/${draftId}/dismiss`)
            .set({ Authorization: `Bearer ${token}` })
            .send({})
            .expect(200);

        expect(dismissed.body.draft.status).toBe("DISMISSED");
    });

    it("promotes a draft into a decision", async () => {
        process.env.LLM_PROVIDER = "mock";

        await prisma.product.create({
            data: {
                name: "Planner Bundle",
                productSource: "ETSY",
                productType: "STATIONERY",
                status: "ACTIVE",
                seasonality: "NONE",
            },
        });

        const weeklyFocus = await request
            .get("/v1/weekly-focus?limit=3")
            .set({ Authorization: `Bearer ${token}` })
            .expect(200);

        const generated = await request
            .post(`/v1/weekly-focus/${weeklyFocus.body.weeklyFocusId}/drafts/generate`)
            .set({ Authorization: `Bearer ${token}` })
            .send({ maxDrafts: 1 })
            .expect(201);

        const draftId = generated.body.drafts[0].id as string;

        const promoted = await request
            .post(`/v1/decision-drafts/${draftId}/promote`)
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
});
