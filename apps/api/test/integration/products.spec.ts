import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, getAuthToken, seedAdmin, resetDatabase, apiPath } from "../helpers.js";
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
            email: "stylenya.party@gmail.com",
            password: "D3s4rr0ll0",
        });

        const token = await getAuthToken(app, admin.email, admin.password);
        cachedHeaders = { Authorization: `Bearer ${token}` };
        return cachedHeaders;
    }

    it("imports Shopify CSV grouped by handle", async () => {
        const headers = await authHeader();
        const csv = [
            "Handle,Title,Status,Type",
            "hat-1,Red Hat,active,Accessories",
            "hat-1,,active,Accessories",
            "hat-1,,,",
        ].join("\n");

        const response = await request
            .post(apiPath("/products/import-csv"))
            .set(headers)
            .attach("file", Buffer.from(csv), "shopify.csv")
            .expect(200);

        expect(response.body.source).toBe("SHOPIFY");
        expect(response.body.created).toBe(1);
        expect(response.body.updated).toBe(0);
        expect(response.body.skippedVariants).toBe(2);
        expect(response.body.forReview).toBe(0);
    });

    it("sends missing title handles to review", async () => {
        const headers = await authHeader();
        const csv = [
            "Handle,Title,Status,Type",
            "bad-handle,,active,Accessories",
            "bad-handle,,,",
        ].join("\n");

        const response = await request
            .post(apiPath("/products/import-csv"))
            .set(headers)
            .attach("file", Buffer.from(csv), "shopify.csv")
            .expect(200);

        expect(response.body.created).toBe(0);
        expect(response.body.forReview).toBe(1);
        expect(response.body.status).toBe("FAILED");

        const reviewProduct = await prisma.product.findFirst({
            where: { productSource: "SHOPIFY", shopifyHandle: "bad-handle" },
        });

        expect(reviewProduct?.status).toBe("REVIEW");
        expect(reviewProduct?.importNotes).toContain("Title");
    });

    it("filters products by source and review status", async () => {
        const headers = await authHeader();

        const shopifyResponse = await request
            .get(apiPath("/products?source=SHOPIFY&status=ACTIVE&page=1&pageSize=50"))
            .set(headers)
            .expect(200);

        expect(Array.isArray(shopifyResponse.body.products)).toBe(true);
        expect(shopifyResponse.body.products.every((p: { productSource: string; status: string }) => p.productSource === "SHOPIFY" && p.status === "ACTIVE")).toBe(true);

        const reviewResponse = await request
            .get(apiPath("/products?status=REVIEW&page=1&pageSize=50"))
            .set(headers)
            .expect(200);

        expect(reviewResponse.body.products.some((p: { status: string }) => p.status === "REVIEW")).toBe(true);
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
            .post(apiPath("/products/import-csv"))
            .set(headers)
            .attach("file", Buffer.from(csv), "etsy.csv")
            .expect(200);

        expect(response.body.source).toBe("ETSY");
        expect(response.body.created).toBe(2);
        expect(response.body.skipped).toBe(1);

        const noStock = await prisma.product.findFirst({
            where: { productSource: "ETSY", name: "No Stock" },
        });
        expect(noStock?.etsyListingId?.startsWith("ETSY_HASH_")).toBe(true);
    });

    it("archives, restores, and deletes products", async () => {
        const headers = await authHeader();

        const createResponse = await request
            .post(apiPath("/products"))
            .set(headers)
            .send({
                name: "Manual Product",
                productSource: "MANUAL",
                productType: "manual",
                status: "DRAFT",
                seasonality: "NONE",
            })
            .expect(201);

        const productId = createResponse.body.product.id as string;

        const archiveResponse = await request
            .post(apiPath(`/products/${productId}/archive`))
            .set(headers)
            .expect(200);
        expect(archiveResponse.body.product.archivedAt).toBeTruthy();

        const restoreResponse = await request
            .post(apiPath(`/products/${productId}/restore`))
            .set(headers)
            .expect(200);
        expect(restoreResponse.body.product.archivedAt).toBeNull();

        await request
            .delete(apiPath(`/products/${productId}`))
            .set(headers)
            .send({ confirm: true })
            .expect(200);

        const deleted = await prisma.product.findUnique({ where: { id: productId } });
        expect(deleted).toBeNull();
    });
});
