import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, seedAdmin, apiPath } from "../helpers.js";

const adminUser = {
    email: "seo.context@stylenya.com",
    password: "D3s4rr0ll0",
};

describe("SEO Context Settings API", () => {
    let app: FastifyInstance;
    let request: ReturnType<typeof supertest>;
    let headers: { Authorization: string };

    beforeAll(async () => {
        app = await createTestServer();
        request = supertest(app.server);
    });

    beforeEach(async () => {
        const admin = await seedAdmin(app, adminUser);
        const token = await getAuthToken(app, admin.email, admin.password);
        headers = { Authorization: `Bearer ${token}` };
    });

    afterAll(async () => {
        await app.close();
    });

    it("creates include/exclude seeds and lists them", async () => {
        const includeResponse = await request
            .post(apiPath("/settings/seo-context/seeds"))
            .set(headers)
            .send({ term: "party", kind: "INCLUDE" })
            .expect(201);

        expect(includeResponse.body.seed.term).toBe("party");
        expect(includeResponse.body.seed.kind).toBe("INCLUDE");

        const excludeResponse = await request
            .post(apiPath("/settings/seo-context/seeds"))
            .set(headers)
            .send({ term: "car", kind: "EXCLUDE" })
            .expect(201);

        expect(excludeResponse.body.seed.term).toBe("car");
        expect(excludeResponse.body.seed.kind).toBe("EXCLUDE");

        const listResponse = await request
            .get(apiPath("/settings/seo-context"))
            .set(headers)
            .expect(200);

        expect(listResponse.body.includeSeeds).toEqual(
            expect.arrayContaining([expect.objectContaining({ term: "party" })])
        );
        expect(listResponse.body.excludeSeeds).toEqual(
            expect.arrayContaining([expect.objectContaining({ term: "car" })])
        );
    });

    it("archives a seed", async () => {
        const createResponse = await request
            .post(apiPath("/settings/seo-context/seeds"))
            .set(headers)
            .send({ term: "ornament", kind: "EXCLUDE" })
            .expect(201);

        const seedId = createResponse.body.seed.id as string;

        const updateResponse = await request
            .patch(apiPath(`/settings/seo-context/seeds/${seedId}`))
            .set(headers)
            .send({ status: "ARCHIVED" })
            .expect(200);

        expect(updateResponse.body.seed.status).toBe("ARCHIVED");
    });
});
