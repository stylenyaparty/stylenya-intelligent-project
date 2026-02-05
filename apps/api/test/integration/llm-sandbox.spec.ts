import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, resetDatabase, seedAdmin, apiPath } from "../helpers.js";
import * as llmService from "../../src/modules/llm/llm.service.js";

describe("LLM Sandbox API", () => {
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

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await app.close();
    });

    it("returns drafts with usage and meta", async () => {
        const mocked = vi.spyOn(llmService, "generateSandboxDrafts").mockResolvedValue({
            drafts: [
                {
                    title: "Seasonal bundle landing page",
                    rationale: "Signals show rising seasonal demand.",
                    recommendedActions: ["Create a landing page", "Bundle top products"],
                    confidence: 82,
                },
            ],
            usage: { input_tokens: 120, output_tokens: 240, total_tokens: 360 },
            meta: { model: "gpt-4.1-mini", elapsedMs: 1234 },
        });

        const response = await request
            .post(apiPath("/llm/sandbox"))
            .set({ Authorization: `Bearer ${token}` })
            .send({
                signals: [
                    {
                        keyword: "summer shoes",
                        avgMonthlySearches: 1200,
                        competitionLevel: "LOW",
                    },
                ],
                seeds: ["summer collection"],
                context: "Focus on seasonal demand.",
            })
            .expect(200);

        expect(response.body.drafts).toHaveLength(1);
        expect(response.body.usage.total_tokens).toBe(360);
        expect(response.body.meta.model).toBe("gpt-4.1-mini");
        expect(mocked).toHaveBeenCalledOnce();
    });

    it("rejects payloads with more than 20 signals", async () => {
        const mocked = vi.spyOn(llmService, "generateSandboxDrafts").mockResolvedValue({
            drafts: [],
            usage: {},
            meta: { model: "gpt-4.1-mini", elapsedMs: 0 },
        });

        const signals = Array.from({ length: 21 }, (_, idx) => ({
            keyword: `signal-${idx}`,
        }));

        const response = await request
            .post(apiPath("/llm/sandbox"))
            .set({ Authorization: `Bearer ${token}` })
            .send({ signals })
            .expect(400);

        expect(response.body.code).toBe("INVALID_SANDBOX_PAYLOAD");
        expect(mocked).not.toHaveBeenCalled();
    });
});
