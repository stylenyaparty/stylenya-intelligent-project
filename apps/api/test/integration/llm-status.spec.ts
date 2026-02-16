import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, seedAdmin, apiPath } from "../helpers.js";
import { resetLLMProviderCache } from "../../src/modules/llm/get-llm-provider.js";

describe("LLM Status API", () => {
    let app: FastifyInstance;
    let request: ReturnType<typeof supertest>;
    let token: string;

    beforeAll(async () => {
        app = await createTestServer();
        request = supertest(app.server);
    });

    beforeEach(async () => {
        resetLLMProviderCache();
        delete process.env.OPENAI_API_KEY;
        delete process.env.LLM_ENABLED;

        const admin = await seedAdmin(app, {
            email: "stylenya.party@gmail.com",
            password: "D3s4rr0ll0",
        });
        token = await getAuthToken(app, admin.email, admin.password);
    });

    afterAll(async () => {
        await app.close();
    });

    it("returns mock when disabled", async () => {
        process.env.LLM_ENABLED = "false";

        const response = await request
            .get(apiPath("/llm/status"))
            .set({ Authorization: `Bearer ${token}` })
            .expect(200);

        expect(response.body.configured).toBe(true);
        expect(response.body.provider).toBe("mock");
    });

    it("returns configured=false when openai is missing API key", async () => {
        process.env.LLM_ENABLED = "true";

        const response = await request
            .get(apiPath("/llm/status"))
            .set({ Authorization: `Bearer ${token}` })
            .expect(200);

        expect(response.body.configured).toBe(false);
        expect(response.body.provider).toBe("disabled");
    });
});
