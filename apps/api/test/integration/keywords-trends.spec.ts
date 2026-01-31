import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, seedAdmin } from "../helpers.js";

const mockInterestOverTime = vi.fn();
const mockRelatedQueries = vi.fn();

vi.mock(
    "google-trends-api",
    () => ({
        default: {
            interestOverTime: (...args: unknown[]) => mockInterestOverTime(...args),
            relatedQueries: (...args: unknown[]) => mockRelatedQueries(...args),
        },
    }),
    { virtual: true }
);

describe("Keywords API (trends provider)", () => {
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
            email: "admin-trends@example.com",
            password: "AdminPass123!",
        });

        const token = await getAuthToken(app, admin.email, admin.password);
        cachedHeaders = { Authorization: `Bearer ${token}` };
        return cachedHeaders;
    }

    it("runs a trends job and stores interest scores without competition", async () => {
        const headers = await authHeader();

        mockInterestOverTime.mockResolvedValue(
            JSON.stringify({
                default: { timelineData: [{ value: [10] }, { value: [55] }, { value: [80] }] },
            })
        );
        mockRelatedQueries.mockResolvedValue(
            JSON.stringify({
                default: {
                    rankedList: [
                        {
                            rankedKeyword: [
                                { query: "birthday banner", value: 75 },
                                { query: "party banner", value: 20 },
                            ],
                        },
                        {
                            rankedKeyword: [{ query: "birthday banner ideas", value: "Breakout" }],
                        },
                    ],
                },
            })
        );

        const seeds = await request
            .post("/v1/keywords/seeds")
            .set(headers)
            .send({ terms: ["birthday banner"] })
            .expect(201);

        const seedId = seeds.body.created[0].id as string;

        const job = await request
            .post("/v1/keywords/jobs")
            .set(headers)
            .send({
                mode: "CUSTOM",
                marketplace: "GOOGLE",
                language: "en",
                seedIds: [seedId],
                providerUsed: "trends",
            })
            .expect(201);

        const run = await request
            .post(`/v1/keywords/jobs/${job.body.job.id}/run`)
            .set(headers)
            .expect(200);

        expect(run.body.job.providerUsed).toBe("trends");
        expect(run.body.items.length).toBeGreaterThan(0);

        const item = run.body.items[0];
        expect(item.resultJson.interestScore).toBeGreaterThanOrEqual(0);
        expect(item.resultJson.interestScore).toBeLessThanOrEqual(100);
        expect(item.resultJson.competitionScore).toBeNull();
        expect(item.providerRaw).toMatchObject({
            seed: "birthday banner",
            relatedQueries: expect.any(Object),
            timeline: expect.any(Object),
        });

        const rerun = await request
            .post(`/v1/keywords/jobs/${job.body.job.id}/run`)
            .set(headers)
            .expect(200);

        expect(rerun.body.items).toEqual(run.body.items);
    });
});
