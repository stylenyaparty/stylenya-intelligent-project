import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, seedAdmin, apiPath } from "../helpers.js";

describe("Legacy API disabled", () => {
    let app: FastifyInstance;
    let request: ReturnType<typeof supertest>;
    let cachedHeaders: { Authorization: string } | null = null;
    let previousLegacyApi: string | undefined;

    beforeAll(async () => {
        previousLegacyApi = process.env.LEGACY_API_ENABLED;
        process.env.LEGACY_API_ENABLED = "false";
        app = await createTestServer();
        request = supertest(app.server);
    });

    afterAll(async () => {
        if (previousLegacyApi === undefined) {
            delete process.env.LEGACY_API_ENABLED;
        } else {
            process.env.LEGACY_API_ENABLED = previousLegacyApi;
        }
        await app.close();
    });

    async function authHeader() {
        if (cachedHeaders) return cachedHeaders;

        const admin = await seedAdmin(app, {
            email: "legacy-disabled@example.com",
            password: "AdminPass123!",
        });
        const token = await getAuthToken(app, admin.email, admin.password);
        cachedHeaders = { Authorization: `Bearer ${token}` };
        return cachedHeaders;
    }

    it("returns 410 for legacy POST endpoints", async () => {
        const headers = await authHeader();

        const response = await request
            .post(apiPath("/keywords/seeds"))
            .set(headers)
            .send({ terms: ["legacy keyword"] })
            .expect(410);

        expect(response.body).toEqual({
            error: "LEGACY_DISABLED",
            message: "Legacy feature disabled",
        });
    });
});
