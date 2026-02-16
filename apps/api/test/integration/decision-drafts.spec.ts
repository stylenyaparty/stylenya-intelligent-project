import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../../src/infrastructure/db/prisma.js";
import { resetLLMProviderCache } from "../../src/modules/llm/get-llm-provider.js";
import { getDecisionDateRange } from "../../src/modules/decisions/decision-date-range.js";
import { createTestServer, getAuthToken, resetDatabase, seedAdmin, apiPath } from "../helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Decision Drafts API", () => {
    let app: FastifyInstance;
    let request: ReturnType<typeof supertest>;
    let token: string;

    beforeAll(async () => {
        app = await createTestServer();
        request = supertest(app.server);
    });

    beforeEach(async () => {
        await resetDatabase();
        resetLLMProviderCache();
        delete process.env.OPENAI_API_KEY;
        process.env.LLM_ENABLED = "false";

        const admin = await seedAdmin(app, {
            email: "stylenya.party@gmail.com",
            password: "D3s4rr0ll0",
        });
        token = await getAuthToken(app, admin.email, admin.password);

        await prisma.productTypeDefinition.createMany({
            data: [
                {
                    key: "custom_hats",
                    label: "Custom Hats",
                    synonymsJson: ["hat", "hats"],
                    status: "ACTIVE",
                },
                {
                    key: "cake_toppers",
                    label: "Custom Cake Toppers",
                    synonymsJson: ["cake topper", "cake toppers"],
                    status: "ACTIVE",
                },
                {
                    key: "birthday_banners",
                    label: "Happy Birthday Banners",
                    synonymsJson: ["party banner", "birthday banner"],
                    status: "ACTIVE",
                },
            ],
        });
    });

    afterAll(async () => {
        await app.close();
    });

    async function uploadSignals(fixture = "gkp-simple.csv") {
        const csvPath = path.resolve(__dirname, "..", "fixtures", fixture);
        const csv = await fs.readFile(csvPath);

        const response = await request
            .post(apiPath("/signals/upload"))
            .set({ Authorization: `Bearer ${token}` })
            .attach("file", csv, "gkp-simple.csv")
            .expect(200);

        return response.body.batch.id as string;
    }

    it("rejects draft generation without auth", async () => {
        await request.post(apiPath("/decision-drafts/generate")).send({}).expect(401);
    });

    it("guards against generation without signals", async () => {
        const response = await request
            .post(apiPath("/decision-drafts/generate"))
            .set({ Authorization: `Bearer ${token}` })
            .expect(400);

        expect(response.body.code).toBe("BATCH_REQUIRED");
    });

    it("generates drafts with the mock provider and persists them", async () => {
        const batchId = await uploadSignals();

        const response = await request
            .post(apiPath(`/decision-drafts/generate?batchId=${batchId}`))
            .set({ Authorization: `Bearer ${token}` })
            .expect(201);

        expect(response.body.drafts.length).toBeGreaterThan(0);
        expect(response.body.drafts.length).toBeLessThanOrEqual(5);

        const keywords = response.body.drafts.flatMap(
            (draft: { keywords: string[] }) => draft.keywords
        );
        const signals = await prisma.keywordSignal.findMany({
            where: { keyword: { in: keywords } },
            select: { keyword: true },
        });
        expect(signals.length).toBeGreaterThan(0);

        const stored = await prisma.decisionDraft.findMany();
        expect(stored.length).toBeGreaterThan(0);
        expect(stored[0].status).toBe("NEW");
    });

    it("never includes excluded terms and stores relevance metadata", async () => {
        await prisma.keywordSeed.createMany({
            data: [
                { term: "party", source: "CUSTOM", status: "ACTIVE", kind: "INCLUDE" },
                { term: "cake topper", source: "CUSTOM", status: "ACTIVE", kind: "INCLUDE" },
                { term: "car", source: "CUSTOM", status: "ACTIVE", kind: "EXCLUDE" },
                { term: "ornament", source: "CUSTOM", status: "ACTIVE", kind: "EXCLUDE" },
            ],
        });

        const batchId = await uploadSignals("gkp-relevance.csv");

        await request
            .post(apiPath(`/decision-drafts/generate?batchId=${batchId}`))
            .set({ Authorization: `Bearer ${token}` })
            .expect(201);

        const draft = await prisma.decisionDraft.findFirst({
            orderBy: { createdAt: "desc" },
        });

        expect(draft).not.toBeNull();
        const snapshot = draft?.payloadSnapshot as
            | {
                  signals: Array<{ keyword: string }>;
                  relevanceMode: string;
                  productTypesActiveCount: number;
                  productTypesMatched: string[];
                  occasionTermsUsed: string[];
                  excludeTermsUsed: string[];
                  filteredOutCount: number;
                  finalSignalCount: number;
              }
            | undefined;

        expect(snapshot?.relevanceMode).toBe("strict");
        expect(snapshot?.productTypesActiveCount).toBeGreaterThan(0);
        expect(snapshot?.productTypesMatched).toEqual(
            expect.arrayContaining(["cake_toppers", "birthday_banners"])
        );
        expect(snapshot?.occasionTermsUsed).toEqual(expect.arrayContaining(["party", "cake topper"]));
        expect(snapshot?.excludeTermsUsed).toEqual(expect.arrayContaining(["car", "ornament"]));
        expect(snapshot?.signals.length).toBe(snapshot?.finalSignalCount);

        const signalKeywords = snapshot?.signals.map((signal) => signal.keyword.toLowerCase()) ?? [];
        expect(signalKeywords.some((keyword) => keyword.includes("car"))).toBe(false);
        expect(signalKeywords.some((keyword) => keyword.includes("ornament"))).toBe(false);
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
                whyNow: "Based on signals",
                riskNotes: "Low",
                nextSteps: ["Action"],
                keywords: ["signal"],
                confidence: null,
                status: "NEW",
                signalIds: ["sig-1"],
            },
        });

        await prisma.decisionDraft.create({
            data: {
                createdDate: yesterdayRange.start,
                title: "Yesterday draft",
                whyNow: "Older",
                riskNotes: "Low",
                nextSteps: ["Action"],
                keywords: ["signal"],
                confidence: null,
                status: "NEW",
                signalIds: ["sig-2"],
            },
        });

        const response = await request
            .get(apiPath("/decision-drafts"))
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
                whyNow: "Test",
                riskNotes: "Low",
                nextSteps: ["Action"],
                keywords: ["signal"],
                confidence: null,
                status: "NEW",
                signalIds: ["sig-1"],
            },
        });

        const dismissed = await request
            .post(apiPath(`/decision-drafts/${draft.id}/dismiss`))
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
                whyNow: "Test",
                riskNotes: "Low",
                nextSteps: ["Action"],
                keywords: ["signal"],
                confidence: 85,
                status: "NEW",
                signalIds: ["sig-1"],
            },
        });

        const promoted = await request
            .post(apiPath(`/decision-drafts/${draft.id}/promote`))
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

    it("persists expansion references when promoting drafts", async () => {
        const range = getDecisionDateRange({ now: new Date() });
        expect(range).toBeTruthy();
        if (!range) return;

        const draft = await prisma.decisionDraft.create({
            data: {
                createdDate: range.start,
                title: "Draft with expansion",
                whyNow: "Test",
                riskNotes: "Low",
                nextSteps: ["Action"],
                keywords: ["signal"],
                confidence: 60,
                status: "NEW",
                signalIds: ["sig-1"],
            },
        });

        const responseJson = {
            expanded: {
                objective: "Grow sales",
                checklist: ["Step 1"],
                seo: {
                    titleIdeas: ["Idea 1"],
                    tagIdeas: ["Tag 1"],
                    descriptionBullets: ["Bullet 1"],
                },
                assetsNeeded: ["Asset 1"],
                twoWeekPlan: {
                    week1: ["Plan 1"],
                    week2: ["Plan 2"],
                },
                risks: ["Risk 1"],
                successMetrics: ["Metric 1"],
            },
        };

        const expansion = await prisma.decisionDraftExpansion.create({
            data: {
                draftId: draft.id,
                kind: "EXPAND",
                promptSnapshot: {},
                responseJson,
                responseRaw: "raw",
                model: "mock-model",
                provider: "mock",
                tokensIn: 10,
                tokensOut: 20,
                latencyMs: 100,
            },
        });

        const promoted = await request
            .post(apiPath(`/decision-drafts/${draft.id}/promote`))
            .set({ Authorization: `Bearer ${token}` })
            .send({})
            .expect(200);

        const decision = await prisma.decision.findUnique({
            where: { id: promoted.body.decision.id },
        });

        expect(decision).not.toBeNull();
        const sources = decision?.sources as
            | {
                  draft?: { id?: string };
                  expansion?: { latestExpansionId?: string };
              }
            | undefined;
        expect(sources?.draft?.id).toBe(draft.id);
        expect(sources?.expansion?.latestExpansionId).toBe(expansion.id);

        const expansionResponse = await request
            .get(apiPath(`/decisions/${promoted.body.decision.id}/expansion`))
            .set({ Authorization: `Bearer ${token}` })
            .expect(200);

        expect(expansionResponse.body.ok).toBe(true);
        expect(expansionResponse.body.expansion.id).toBe(expansion.id);
        expect(expansionResponse.body.expansion.responseJson).toEqual(responseJson);
    });

    it("enforces traceability on promotion", async () => {
        const range = getDecisionDateRange({ now: new Date() });
        expect(range).toBeTruthy();
        if (!range) return;

        const draft = await prisma.decisionDraft.create({
            data: {
                createdDate: range.start,
                title: "Untraceable draft",
                whyNow: "Missing signals",
                riskNotes: "Low",
                nextSteps: ["Action"],
                keywords: ["signal"],
                confidence: 22,
                status: "NEW",
                signalIds: [],
            },
        });

        const response = await request
            .post(apiPath(`/decision-drafts/${draft.id}/promote`))
            .set({ Authorization: `Bearer ${token}` })
            .send({})
            .expect(409);

        expect(response.body.code).toBe("TRACEABILITY_REQUIRED");
    });

    it("expands a draft and logs the expansion event", async () => {
        const batchId = await uploadSignals();

        const generate = await request
            .post(apiPath(`/decision-drafts/generate?batchId=${batchId}`))
            .set({ Authorization: `Bearer ${token}` })
            .expect(201);

        const draftId = generate.body.drafts[0]?.id as string;
        expect(draftId).toBeTruthy();

        const response = await request
            .post(apiPath(`/decision-drafts/${draftId}/expand`))
            .set({ Authorization: `Bearer ${token}` })
            .send({ focus: "SEO tags + title" })
            .expect(200);

        expect(response.body.expansion).toBeTruthy();
        expect(response.body.draft).toBeTruthy();

        const expansion = await prisma.decisionDraftExpansion.findFirst({
            where: { draftId },
            orderBy: { createdAt: "desc" },
        });

        expect(expansion).not.toBeNull();
        const responseJson = expansion?.responseJson as { expanded?: { checklist?: string[] } };
        expect(responseJson?.expanded?.checklist?.length ?? 0).toBeGreaterThan(0);

        const logEvent = await prisma.decisionLogEvent.findFirst({
            where: { eventType: "DRAFT_EXPANDED", refId: draftId },
        });
        expect(logEvent).not.toBeNull();

        const updatedDraft = await prisma.decisionDraft.findUnique({ where: { id: draftId } });
        expect(updatedDraft?.lastExpandedAt).not.toBeNull();
        expect(updatedDraft?.expansionsCount).toBeGreaterThan(0);
    });
});
