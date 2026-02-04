import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTestServer, getAuthToken, resetDatabase, seedAdmin } from "../helpers.js";

describe("Signals API", () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
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
            email: "signals@example.com",
            password: "SignalsPass123!",
        });

        const token = await getAuthToken(app, admin.email, admin.password);
        cachedHeaders = { Authorization: `Bearer ${token}` };
        return cachedHeaders;
    }

    it("imports GKP CSV successfully", async () => {
        const headers = await authHeader();
        const csvPath = path.resolve(__dirname, "..", "fixtures", "gkp-simple.csv");
        const csv = await fs.readFile(csvPath);

        const response = await request
            .post("/v1/signal-batches/gkp-csv")
            .set(headers)
            .attach("file", csv, "gkp-simple.csv")
            .expect(200);

        expect(response.body.importedCount).toBeGreaterThan(0);
        expect(response.body.skippedDuplicatesCount).toBe(0);
        expect(response.body.batch.source).toBe("GKP_CSV");
    });

    it("skips duplicate keywords in a batch", async () => {
        const headers = await authHeader();
        const csvPath = path.resolve(__dirname, "..", "fixtures", "gkp-duplicates.csv");
        const csv = await fs.readFile(csvPath);

        const response = await request
            .post("/v1/signal-batches/gkp-csv")
            .set(headers)
            .attach("file", csv, "gkp-duplicates.csv")
            .expect(200);

        expect(response.body.skippedDuplicatesCount).toBeGreaterThan(0);
    });

    it("lists signal batches", async () => {
        const headers = await authHeader();

        await request
            .post("/v1/signal-batches/gkp-csv")
            .set(headers)
            .attach(
                "file",
                Buffer.from(
                    [
                        "Keyword,Avg. monthly searches,Competition,Top of page bid (low range),Top of page bid (high range)",
                        "batch seed,111,LOW,0.4,0.9",
                    ].join("\n")
                ),
                "gkp-batch.csv"
            )
            .expect(200);

        const response = await request
            .get("/v1/signal-batches")
            .set(headers)
            .expect(200);

        expect(response.body.batches.length).toBeGreaterThan(0);
    });

    it("lists signals for a batch", async () => {
        const headers = await authHeader();
        const importResponse = await request
            .post("/v1/signal-batches/gkp-csv")
            .set(headers)
            .attach(
                "file",
                Buffer.from(
                    [
                        "Keyword,Avg. monthly searches,Competition,Top of page bid (low range),Top of page bid (high range)",
                        "trend hat,111,LOW,0.4,0.9",
                    ].join("\n")
                ),
                "gkp-inline.csv"
            )
            .expect(200);

        const batchId = importResponse.body.batch.id as string;

        const response = await request
            .get(`/v1/signals?batchId=${batchId}`)
            .set(headers)
            .expect(200);

        expect(response.body.signals.length).toBeGreaterThan(0);
        expect(response.body.signals[0].batchId).toBe(batchId);
    });

    it("returns 400 when file is missing", async () => {
        const headers = await authHeader();

        await request
            .post("/v1/signal-batches/gkp-csv")
            .set(headers)
            .expect(400);
    });
});
