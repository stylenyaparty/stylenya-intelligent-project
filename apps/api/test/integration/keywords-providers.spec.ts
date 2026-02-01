import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, resetDatabase, seedAdmin } from "../helpers.js";

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

describe("Keywords provider selection", () => {
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
            email: "admin-providers@example.com",
            password: "AdminPass123!",
        });

        const token = await getAuthToken(app, admin.email, admin.password);
        cachedHeaders = { Authorization: `Bearer ${token}` };
        return cachedHeaders;
    }

    async function setGoogleAdsSettings(
        headers: { Authorization: string },
        enabled: boolean
    ) {
        await request
            .post("/v1/settings/google-ads")
            .set(headers)
            .send({
                enabled,
                customerId: enabled ? "1234567890" : undefined,
                developerToken: enabled ? "dev-token" : undefined,
                clientId: enabled ? "client-id" : undefined,
                clientSecret: enabled ? "client-secret" : undefined,
                refreshToken: enabled ? "refresh-token" : undefined,
            })
            .expect(enabled ? 200 : 200);
    }

    async function createSeed(headers: { Authorization: string }, term: string) {
        const seeds = await request
            .post("/v1/keywords/seeds")
            .set(headers)
            .send({ terms: [term] })
            .expect(201);

        return seeds.body.created[0].id as string;
    }

    it("AUTO selects TRENDS when Google Ads is not configured", async () => {
        const headers = await authHeader();

        mockInterestOverTime.mockResolvedValue(
            JSON.stringify({
                default: { timelineData: [{ value: [12] }, { value: [44] }] },
            })
        );
        mockRelatedQueries.mockResolvedValue(
            JSON.stringify({
                default: {
                    rankedList: [
                        { rankedKeyword: [{ query: "auto seed idea", value: 50 }] },
                        { rankedKeyword: [] },
                    ],
                },
            })
        );

        const seedId = await createSeed(headers, "auto provider seed");

        const job = await request
            .post("/v1/keywords/jobs")
            .set(headers)
            .send({
                mode: "CUSTOM",
                marketplace: "GOOGLE",
                language: "en",
                country: "us",
                seedIds: [seedId],
                providerUsed: "AUTO",
            })
            .expect(201);

        const run = await request
            .post(`/v1/keywords/jobs/${job.body.job.id}/run`)
            .set(headers)
            .expect(200);

        expect(run.body.job.providerUsed).toBe("AUTO");
        expect(run.body.items.length).toBeGreaterThan(0);
    });

    it("AUTO selects GOOGLE_ADS when configured", async () => {
        const headers = await authHeader();
        await setGoogleAdsSettings(headers, true);

        const seedId = await createSeed(headers, "auto ads seed");

        const job = await request
            .post("/v1/keywords/jobs")
            .set(headers)
            .send({
                mode: "CUSTOM",
                marketplace: "GOOGLE",
                language: "en",
                country: "us",
                seedIds: [seedId],
                providerUsed: "AUTO",
            })
            .expect(201);

        const run = await request
            .post(`/v1/keywords/jobs/${job.body.job.id}/run`)
            .set(headers)
            .expect(503);

        expect(run.body.code).toBe("PROVIDER_UNAVAILABLE");
    });

    it("rejects explicit GOOGLE_ADS when not configured", async () => {
        const headers = await authHeader();
        await setGoogleAdsSettings(headers, false);

        const seedId = await createSeed(headers, "ads explicit seed");

        const response = await request
            .post("/v1/keywords/jobs")
            .set(headers)
            .send({
                mode: "CUSTOM",
                marketplace: "GOOGLE",
                language: "en",
                country: "us",
                seedIds: [seedId],
                providerUsed: "GOOGLE_ADS",
            })
            .expect(400);

        expect(response.body.code).toBe("GOOGLE_ADS_NOT_CONFIGURED");
    });
});
