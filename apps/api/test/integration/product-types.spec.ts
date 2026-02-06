import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, resetDatabase, seedAdmin, apiPath } from "../helpers.js";


describe("Product Types API", () => {
    let app: FastifyInstance;
    let request: ReturnType<typeof supertest>;
    let token: string;

    beforeAll(async () => {
        await resetDatabase();
        app = await createTestServer();
        request = supertest(app.server);

        const admin = await seedAdmin(app, {
            email: "product-types@example.com",
            password: "ProductTypes123!",
        });
        token = await getAuthToken(app, admin.email, admin.password);
    });

    afterAll(async () => {
        await app.close();
    });

    it("creates, updates, and archives product types", async () => {
        const createResponse = await request
            .post(apiPath("/settings/product-types"))
            .set({ Authorization: `Bearer ${token}` })
            .send({ label: "Custom Cake Toppers", synonyms: ["cake topper", "cake toppers"] })
            .expect(201);

        expect(createResponse.body.productType.key).toBe("custom_cake_toppers");
        expect(createResponse.body.productType.synonymsJson).toEqual(
            expect.arrayContaining(["cake topper", "cake toppers"])
        );

        const productTypeId = createResponse.body.productType.id as string;

        const updateResponse = await request
            .patch(apiPath(`/settings/product-types/${productTypeId}`))
            .set({ Authorization: `Bearer ${token}` })
            .send({ label: "Custom Cake Toppers Updated", synonyms: ["cake topper"] })
            .expect(200);

        expect(updateResponse.body.productType.label).toBe("Custom Cake Toppers Updated");

        await request
            .patch(apiPath(`/settings/product-types/${productTypeId}`))
            .set({ Authorization: `Bearer ${token}` })
            .send({ status: "ARCHIVED" })
            .expect(200);

        const listResponse = await request
            .get(apiPath("/settings/product-types?status=archived"))
            .set({ Authorization: `Bearer ${token}` })
            .expect(200);

        expect(listResponse.body.productTypes.length).toBeGreaterThan(0);
        expect(listResponse.body.productTypes[0].status).toBe("ARCHIVED");
    });
});
