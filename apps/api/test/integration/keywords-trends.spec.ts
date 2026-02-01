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
                country: "us",
                seedIds: [seedId],
                providerUsed: "trends",
            })
            .expect(201);

        const run = await request
            .post(`/v1/keywords/jobs/${job.body.job.id}/run`)
            .set(headers)
            .expect(200);

        expect(run.body.job.providerUsed).toBe("trends");
        expect(run.body.seedCount).toBeGreaterThan(0);
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

    it("handles concurrent run requests without returning 500s", async () => {
        const headers = await authHeader();

        const interestResolvers: Array<(value: string) => void> = [];
        const relatedResolvers: Array<(value: string) => void> = [];

        mockInterestOverTime.mockImplementation(
            () =>
                new Promise((resolve) => {
                    interestResolvers.push(resolve);
                })
        );
        mockRelatedQueries.mockImplementation(
            () =>
                new Promise((resolve) => {
                    relatedResolvers.push(resolve);
                })
        );

        const seeds = await request
            .post("/v1/keywords/seeds")
            .set(headers)
            .send({ terms: ["concurrent seed"] })
            .expect(201);

        const seedId = seeds.body.created[0].id as string;

        const job = await request
            .post("/v1/keywords/jobs")
            .set(headers)
            .send({
                mode: "CUSTOM",
                marketplace: "GOOGLE",
                language: "en",
                country: "us",
                seedIds: [seedId],
                providerUsed: "trends",
            })
            .expect(201);

        const runRequest = () =>
            request
                .post(`/v1/keywords/jobs/${job.body.job.id}/run`)
                .set(headers)
                .send({});

        const firstRun = runRequest();
        const secondRun = runRequest();

        const waitForResolvers = async () => {
            for (let i = 0; i < 40; i += 1) {
                if (interestResolvers.length >= 1 && relatedResolvers.length >= 1) {
                    return;
                }
                await new Promise((resolve) => setTimeout(resolve, 5));
            }
            throw new Error("Timed out waiting for trends mocks");
        };

        await waitForResolvers();

        const interestPayload = JSON.stringify({
            default: { timelineData: [{ value: [12] }, { value: [40] }, { value: [70] }] },
        });
        const relatedPayload = JSON.stringify({
            default: {
                rankedList: [
                    { rankedKeyword: [{ query: "concurrent idea", value: 55 }] },
                    { rankedKeyword: [{ query: "concurrent idea 2", value: "Breakout" }] },
                ],
            },
        });

        interestResolvers.forEach((resolve) => resolve(interestPayload));
        relatedResolvers.forEach((resolve) => resolve(relatedPayload));

        const [firstResponse, secondResponse] = await Promise.all([firstRun, secondRun]);
        const statuses = [firstResponse.status, secondResponse.status].sort();

        expect(statuses).toEqual([200, 409]);
        expect([firstResponse.status, secondResponse.status]).not.toContain(500);

        const conflictResponse =
            firstResponse.status === 409 ? firstResponse : secondResponse;
        expect(conflictResponse.body.error).toBe("JOB_ALREADY_RUNNING");
    });

    it("returns NO_SEEDS_MATCHING_JOB when no active seeds exist", async () => {
        const headers = await authHeader();

        const seeds = await request
            .post("/v1/keywords/seeds")
            .set(headers)
            .send({ terms: ["empty run seed"] })
            .expect(201);

        const seedId = seeds.body.created[0].id as string;

        const job = await request
            .post("/v1/keywords/jobs")
            .set(headers)
            .send({
                mode: "AUTO",
                marketplace: "GOOGLE",
                language: "en",
                country: "us",
                providerUsed: "trends",
            })
            .expect(201);

        await request
            .patch(`/v1/keywords/seeds/${seedId}`)
            .set(headers)
            .send({ status: "ARCHIVED" })
            .expect(200);

        const run = await request
            .post(`/v1/keywords/jobs/${job.body.job.id}/run`)
            .set(headers)
            .expect(409);

        expect(run.body.error).toBe("NO_SEEDS_MATCHING_JOB");
    });

    it("returns PROVIDER_NOT_CONFIGURED when trends provider is disabled", async () => {
        const headers = await authHeader();
        const previous = process.env.KEYWORD_TRENDS_ENABLED;
        process.env.KEYWORD_TRENDS_ENABLED = "false";

        try {
            const seeds = await request
                .post("/v1/keywords/seeds")
                .set(headers)
                .send({ terms: ["banner decor"] })
                .expect(201);

            const seedId = seeds.body.created[0].id as string;

            const job = await request
                .post("/v1/keywords/jobs")
                .set(headers)
                .send({
                    mode: "CUSTOM",
                    marketplace: "GOOGLE",
                    language: "en",
                    country: "us",
                    seedIds: [seedId],
                    providerUsed: "trends",
                })
                .expect(201);

            const run = await request
                .post(`/v1/keywords/jobs/${job.body.job.id}/run`)
                .set(headers)
                .expect(400);

            expect(run.body.error).toBe("PROVIDER_NOT_CONFIGURED");
        } finally {
            if (previous === undefined) {
                delete process.env.KEYWORD_TRENDS_ENABLED;
            } else {
                process.env.KEYWORD_TRENDS_ENABLED = previous;
            }
        }
    });
});
