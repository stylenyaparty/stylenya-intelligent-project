import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, seedAdmin, resetDatabase, apiPath } from "../helpers.js";
import { prisma } from "../../src/infrastructure/db/prisma.js";
import { getDecisionDateRange } from "../../src/modules/decisions/decision-date-range.js";


describe("Decisions API", () => {
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

    function buildDecisionPayload() {
        return {
            actionType: "PROMOTE",
            targetType: "KEYWORD",
            targetId: `keyword-${Math.random().toString(16).slice(2)}`,
            title: "Promote keyword",
            rationale: "Testing decision list filters",
            priorityScore: 50,
        } as const;
    }

    function buildDedupeKey() {
        return `dedupe-${Math.random().toString(16).slice(2)}`;
    }

    const nyFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    function formatNyDate(date: Date) {
        return nyFormatter.format(date);
    }

    it("creates a planned decision from weekly focus payload", async () => {
        const headers = await authHeader();

        const response = await request
            .post(apiPath("/decisions"))
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
            .post(apiPath("/decisions"))
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
            .get(apiPath("/decisions?limit=10"))
            .set(headers)
            .expect(200);

        expect(response.body.ok).toBe(true);
        const ids = response.body.decisions.map((d: { id: string }) => d.id);
        expect(ids).toContain(created.body.decision.id);
    });

    it("updates decision status", async () => {
        const headers = await authHeader();

        const created = await request
            .post(apiPath("/decisions"))
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
            .patch(apiPath(`/decisions/${created.body.decision.id}`))
            .set(headers)
            .send({ status: "EXECUTED" })
            .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.decision.status).toBe("EXECUTED");
    });

    it("dedupes duplicate weekly focus decisions", async () => {
        const headers = await authHeader();

        const payload = {
            actionType: "CREATE",
            targetType: "KEYWORD",
            targetId: "duplicate-keyword-action",
            title: "Create product opportunity for duplicate keyword",
            rationale: "Testing idempotent decision creation",
            priorityScore: 55,
            sources: [{ keyword: "duplicate keyword", signalId: "sig-dupe" }],
        };

        const first = await request
            .post(apiPath("/decisions"))
            .set(headers)
            .send(payload)
            .expect(201);

        const second = await request
            .post(apiPath("/decisions"))
            .set(headers)
            .send(payload)
            .expect(200);

        expect(second.body.decision.id).toBe(first.body.decision.id);

        const list = await request
            .get(apiPath("/decisions?limit=50"))
            .set(headers)
            .expect(200);

        const matching = list.body.decisions.filter(
            (decision: { actionType: string; targetId: string }) =>
                decision.actionType === payload.actionType &&
                decision.targetId === payload.targetId
        );

        expect(matching).toHaveLength(1);
    });

    it("defaults to today's decisions based on New York time", async () => {
        const headers = await authHeader();

        const range = getDecisionDateRange({ now: new Date() });
        expect(range).toBeTruthy();
        if (!range) return;

        const todayDecision = await prisma.decision.create({
            data: {
                ...buildDecisionPayload(),
                dedupeKey: buildDedupeKey(),
                createdAt: new Date(range.start.getTime() + 60 * 1000),
            },
        });

        const yesterdayDecision = await prisma.decision.create({
            data: {
                ...buildDecisionPayload(),
                dedupeKey: buildDedupeKey(),
                createdAt: new Date(range.start.getTime() - 60 * 1000),
            },
        });

        const response = await request
            .get(apiPath("/decisions?limit=50"))
            .set(headers)
            .expect(200);

        const ids = response.body.decisions.map((d: { id: string }) => d.id);
        expect(ids).toContain(todayDecision.id);
        expect(ids).not.toContain(yesterdayDecision.id);
    });

    it("returns all decisions when mode=all", async () => {
        const headers = await authHeader();

        const range = getDecisionDateRange({ now: new Date() });
        expect(range).toBeTruthy();
        if (!range) return;

        const todayDecision = await prisma.decision.create({
            data: {
                ...buildDecisionPayload(),
                dedupeKey: buildDedupeKey(),
                createdAt: new Date(range.start.getTime() + 2 * 60 * 1000),
            },
        });

        const yesterdayDecision = await prisma.decision.create({
            data: {
                ...buildDecisionPayload(),
                dedupeKey: buildDedupeKey(),
                createdAt: new Date(range.start.getTime() - 2 * 60 * 1000),
            },
        });

        const response = await request
            .get(apiPath("/decisions?mode=all&limit=50"))
            .set(headers)
            .expect(200);

        const ids = response.body.decisions.map((d: { id: string }) => d.id);
        expect(ids).toContain(todayDecision.id);
        expect(ids).toContain(yesterdayDecision.id);
    });

    it("filters decisions by explicit date", async () => {
        const headers = await authHeader();

        const todayRange = getDecisionDateRange({ now: new Date() });
        expect(todayRange).toBeTruthy();
        if (!todayRange) return;

        const targetDate = formatNyDate(new Date(todayRange.start.getTime() - 60 * 60 * 1000));
        const targetRange = getDecisionDateRange({ date: targetDate });
        expect(targetRange).toBeTruthy();
        if (!targetRange) return;

        const targetDecision = await prisma.decision.create({
            data: {
                ...buildDecisionPayload(),
                dedupeKey: buildDedupeKey(),
                createdAt: new Date(targetRange.start.getTime() + 5 * 60 * 1000),
            },
        });

        const otherDecision = await prisma.decision.create({
            data: {
                ...buildDecisionPayload(),
                dedupeKey: buildDedupeKey(),
                createdAt: new Date(targetRange.start.getTime() - 5 * 60 * 1000),
            },
        });

        const response = await request
            .get(apiPath(`/decisions?date=${targetDate}&limit=50`))
            .set(headers)
            .expect(200);

        const ids = response.body.decisions.map((d: { id: string }) => d.id);
        expect(ids).toContain(targetDecision.id);
        expect(ids).not.toContain(otherDecision.id);
    });

    it("respects New York day boundaries for date filters", async () => {
        const headers = await authHeader();
        const dateString = formatNyDate(new Date());

        const range = getDecisionDateRange({ date: dateString });
        expect(range).toBeTruthy();
        if (!range) return;

        const startDecision = await prisma.decision.create({
            data: {
                ...buildDecisionPayload(),
                dedupeKey: buildDedupeKey(),
                createdAt: new Date(range.start.getTime()),
            },
        });

        const endMinusDecision = await prisma.decision.create({
            data: {
                ...buildDecisionPayload(),
                dedupeKey: buildDedupeKey(),
                createdAt: new Date(range.end.getTime() - 1000),
            },
        });

        const beforeDecision = await prisma.decision.create({
            data: {
                ...buildDecisionPayload(),
                dedupeKey: buildDedupeKey(),
                createdAt: new Date(range.start.getTime() - 1000),
            },
        });

        const endDecision = await prisma.decision.create({
            data: {
                ...buildDecisionPayload(),
                dedupeKey: buildDedupeKey(),
                createdAt: new Date(range.end.getTime()),
            },
        });

        const response = await request
            .get(apiPath(`/decisions?date=${dateString}&limit=50`))
            .set(headers)
            .expect(200);

        const ids = response.body.decisions.map((d: { id: string }) => d.id);
        expect(ids).toContain(startDecision.id);
        expect(ids).toContain(endMinusDecision.id);
        expect(ids).not.toContain(beforeDecision.id);
        expect(ids).not.toContain(endDecision.id);
    });
});
