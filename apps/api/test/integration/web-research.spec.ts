import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { apiPath, createTestServer } from "../helpers.js";
import { prisma } from "../../src/infrastructure/db/prisma.js";
import { setWebResearchProviderForTests } from "../../src/modules/web-research/web-research.service.js";
import type { WebResearchProvider } from "../../src/modules/web-research/web-research.types.js";
import { ProviderUnavailableError } from "../../src/modules/web-research/providers/tavily.http.provider.js";

describe("Web research module", () => {
    let app: FastifyInstance;
    let request: ReturnType<typeof supertest>;

    beforeAll(async () => {
        app = await createTestServer();
        request = supertest(app.server);
    });

    beforeEach(() => {
        setWebResearchProviderForTests(null);
    });

    afterAll(async () => {
        setWebResearchProviderForTests(null);
        await app.close();
    });

    it("persists successful runs with rows, clusters, and evidence", async () => {
        const provider: WebResearchProvider = {
            async search() {
                return [
                    {
                        url: "https://example.com/one",
                        title: "Example One",
                        snippet: "Snippet one",
                        publishedAt: "2025-01-01T00:00:00.000Z",
                        score: 0.8,
                    },
                    {
                        url: "https://news.example.org/two",
                        title: "Example Two",
                        snippet: "Snippet two",
                        score: 0.7,
                    },
                ];
            },
        };

        setWebResearchProviderForTests(provider);

        const response = await request.post(apiPath("/research/web")).send({ query: "wedding gifts", mode: "quick" }).expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.run.status).toBe("SUCCESS");
        expect(response.body.run.rows.length).toBe(2);
        expect(response.body.run.clusters.length).toBeGreaterThan(0);
        expect(response.body.run.rows[0].evidences.length).toBe(1);

        const persisted = await prisma.webResearchRun.findUnique({
            where: { id: response.body.run.id },
            include: {
                rows: { include: { evidences: true } },
                clusters: true,
            },
        });

        expect(persisted?.status).toBe("SUCCESS");
        expect(persisted?.rows.length).toBe(2);
        expect(persisted?.rows[0]?.evidences.length).toBe(1);
    });

    it("retrieves a run by id", async () => {
        const provider: WebResearchProvider = {
            async search() {
                return [{ url: "https://example.com/one", title: "Example One" }];
            },
        };

        setWebResearchProviderForTests(provider);

        const createResponse = await request.post(apiPath("/research/web")).send({ query: "gift research", mode: "quick" }).expect(200);
        const runId = createResponse.body.run.id as string;

        const getResponse = await request.get(apiPath(`/research/runs/${runId}`)).expect(200);
        expect(getResponse.body.ok).toBe(true);
        expect(getResponse.body.run.id).toBe(runId);
        expect(getResponse.body.run.rows.length).toBe(1);
    });

    it("returns 400 for invalid request body", async () => {
        await request.post(apiPath("/research/web")).send({ mode: "quick" }).expect(400);
    });

    it("returns 503 and persists FAILED when provider fails", async () => {
        const provider: WebResearchProvider = {
            async search() {
                throw new ProviderUnavailableError("provider timeout");
            },
        };

        setWebResearchProviderForTests(provider);

        const response = await request.post(apiPath("/research/web")).send({ query: "gift research", mode: "quick" }).expect(503);
        expect(response.body.error).toBe("Provider unavailable");

        const failedRun = await prisma.webResearchRun.findFirst({
            where: { query: "gift research" },
            orderBy: { createdAt: "desc" },
        });

        expect(failedRun).not.toBeNull();
        expect(failedRun?.status).toBe("FAILED");
    });
});
