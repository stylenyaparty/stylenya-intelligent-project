import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, seedAdmin, resetDatabase } from "../helpers.js";
import { prisma } from "../../src/infrastructure/db/prisma.js";

describe("Products API", () => {
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
            email: "products-admin@example.com",
            password: "AdminPass123!",
        });

        const token = await getAuthToken(app, admin.email, admin.password);
        cachedHeaders = { Authorization: `Bearer ${token}` };
        return cachedHeaders;
    }

    it("imports Shopify CSV with dedupe and upsert", async () => {
        const headers = await authHeader();
        const csv = [
            "Handle,Title,Status,Type",
            "hat-1,Red Hat,active,Accessories",
            "hat-1,,active,Accessories",
            "bag-1,Everyday Bag,draft,",
        ].join("\n");

        const response = await request
            .post("/v1/products/import-csv")
            .set(headers)
            .attach("file", Buffer.from(csv), "shopify.csv")
            .expect(200);

        expect(response.body.source).toBe("SHOPIFY");
        expect(response.body.createdCount).toBe(2);
        expect(response.body.updatedCount).toBe(0);
        expect(response.body.skippedCount).toBe(1);
        expect(response.body.errors).toHaveLength(1);

        const updatedCsv = [
            "Handle,Title,Status,Type",
            "hat-1,Red Hat Updated,active,Accessories",
            "bag-1,Everyday Bag,draft,Bags",
        ].join("\n");

        const updateResponse = await request
            .post("/v1/products/import-csv")
            .set(headers)
            .attach("file", Buffer.from(updatedCsv), "shopify.csv")
            .expect(200);

        expect(updateResponse.body.updatedCount).toBe(2);

        const bag = await prisma.product.findFirst({
            where: { productSource: "SHOPIFY", shopifyProductId: "bag-1" },
        });
        expect(bag?.productType).toBe("Bags");
    });

    it("imports Etsy CSV with SKU/hash handling", async () => {
        const headers = await authHeader();
        const csv = [
            "TITLE,QUANTITY,SKU",
            "Etsy Item,2,SKU123",
            "No Stock,0,",
            ",1,SKU999",
        ].join("\n");

        const response = await request
            .post("/v1/products/import-csv")
            .set(headers)
            .attach("file", Buffer.from(csv), "etsy.csv")
            .expect(200);

        expect(response.body.source).toBe("ETSY");
        expect(response.body.createdCount).toBe(2);
        expect(response.body.skippedCount).toBe(1);

        const noStock = await prisma.product.findFirst({
            where: { productSource: "ETSY", name: "No Stock" },
        });
        expect(noStock?.etsyListingId?.startsWith("ETSY_HASH_")).toBe(true);
    });

    it("archives, restores, and deletes products", async () => {
        const headers = await authHeader();

        const createResponse = await request
            .post("/v1/products")
            .set(headers)
            .send({
                name: "Manual Product",
                productSource: "SHOPIFY",
                productType: "manual",
                status: "DRAFT",
                seasonality: "NONE",
            })
            .expect(201);

        const productId = createResponse.body.product.id as string;

        const archiveResponse = await request
            .post(`/v1/products/${productId}/archive`)
            .set(headers)
            .expect(200);
        expect(archiveResponse.body.product.archivedAt).toBeTruthy();

        const restoreResponse = await request
            .post(`/v1/products/${productId}/restore`)
            .set(headers)
            .expect(200);
        expect(restoreResponse.body.product.archivedAt).toBeNull();

        await request
            .delete(`/v1/products/${productId}`)
            .set(headers)
            .send({ confirm: true })
            .expect(200);

        const deleted = await prisma.product.findUnique({ where: { id: productId } });
        expect(deleted).toBeNull();
    });
});
