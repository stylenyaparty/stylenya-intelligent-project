import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, resetDatabase, seedAdmin } from "../helpers.js";
import { resetLLMProviderCache } from "../../src/modules/llm/get-llm-provider.js";

describe("LLM Status API", () => {
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

    beforeEach(() => {
        resetLLMProviderCache();
        delete process.env.OPENAI_API_KEY;
    });

    afterAll(async () => {
        await app.close();
    });

    it("returns configured=false when disabled", async () => {
        process.env.LLM_PROVIDER = "disabled";

        const response = await request
            .get("/v1/llm/status")
            .set({ Authorization: `Bearer ${token}` })
            .expect(200);

        expect(response.body.configured).toBe(false);
        expect(response.body.provider).toBe("disabled");
    });

    it("returns configured=false when openai is missing API key", async () => {
        process.env.LLM_PROVIDER = "openai";

        const response = await request
            .get("/v1/llm/status")
            .set({ Authorization: `Bearer ${token}` })
            .expect(200);

        expect(response.body.configured).toBe(false);
        expect(response.body.provider).toBe("disabled");
    });
});
