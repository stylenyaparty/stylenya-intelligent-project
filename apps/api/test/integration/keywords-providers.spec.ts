import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, resetDatabase, seedAdmin, apiPath } from "../helpers.js";

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
            email: "stylenya.party@gmail.com",
            password: "D3s4rr0ll0",
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
            .post(apiPath("/settings/google-ads"))
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
            .post(apiPath("/keywords/seeds"))
            .set(headers)
            .send({ terms: [term] })
            .expect(201);

        return seeds.body.created[0].id as string;
    }

    it("AUTO returns not configured when Google Ads is missing", async () => {
        const headers = await authHeader();

        const seedId = await createSeed(headers, "auto provider seed");

        const job = await request
            .post(apiPath("/keywords/jobs"))
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
            .post(apiPath(`/keywords/jobs/${job.body.job.id}/run`))
            .set(headers)
            .expect(400);

        expect(run.body.code).toBe("PROVIDER_NOT_CONFIGURED");
    });

    it("AUTO selects GOOGLE_ADS when configured", async () => {
        const headers = await authHeader();
        await setGoogleAdsSettings(headers, true);

        const seedId = await createSeed(headers, "auto ads seed");

        const job = await request
            .post(apiPath("/keywords/jobs"))
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
            .post(apiPath(`/keywords/jobs/${job.body.job.id}/run`))
            .set(headers)
            .expect(503);

        expect(run.body.code).toBe("PROVIDER_UNAVAILABLE");
    });

    it("rejects explicit GOOGLE_ADS when not configured", async () => {
        const headers = await authHeader();
        await setGoogleAdsSettings(headers, false);

        const seedId = await createSeed(headers, "ads explicit seed");

        const response = await request
            .post(apiPath("/keywords/jobs"))
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
