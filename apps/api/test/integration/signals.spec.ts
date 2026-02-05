import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTestServer, getAuthToken, resetDatabase, seedAdmin, apiPath } from "../helpers.js";

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
            .post(apiPath("/signals/upload"))
            .set(headers)
            .attach("file", csv, "gkp-simple.csv")
            .expect(200);

        expect(response.body.importedRows).toBeGreaterThan(0);
        expect(response.body.skippedRows).toBe(0);
        expect(response.body.batch.source).toBe("GKP_CSV");
    });

    it("skips duplicate keywords in a batch", async () => {
        const headers = await authHeader();
        const csvPath = path.resolve(__dirname, "..", "fixtures", "gkp-duplicates.csv");
        const csv = await fs.readFile(csvPath);

        const response = await request
            .post(apiPath("/signals/upload"))
            .set(headers)
            .attach("file", csv, "gkp-duplicates.csv")
            .expect(200);

        expect(response.body.skippedRows).toBeGreaterThan(0);
    });

    it("imports UTF-16 tab separated GKP CSV", async () => {
        const headers = await authHeader();
        const utf16Payload = [
            "Keyword Stats 2025-02-01",
            "Location: United States",
            "Keyword\tAvg. monthly searches\tCompetition\tCompetition (indexed value)\tTop of page bid (low range)\tTop of page bid (high range)\tThree month change\tYoY change\tCurrency\tSearches: Jan 2025\tSearches: Feb 2025",
            "cafe mug\t1,200\tLow\t12\t0.4\t1.1\t-90%\t20%\tUSD\t1100\t1300",
            "tea cup\t<10\tHigh\t80\t1.2\t2.4\t5%\t-10%\tUSD\t5\t8",
        ].join("\n");
        const csv = Buffer.from(utf16Payload, "utf16le");

        const response = await request
            .post(apiPath("/signals/upload"))
            .set(headers)
            .attach("file", csv, "gkp-utf16.csv")
            .expect(200);

        expect(response.body.importedRows).toBeGreaterThan(0);
        expect(response.body.batch.columnsDetected.length).toBeGreaterThan(0);
    });

    it("lists signal batches", async () => {
        const headers = await authHeader();

        await request
            .post(apiPath("/signals/upload"))
            .set(headers)
            .attach(
                "file",
                Buffer.from(
                    [
                        "Keyword Stats 2025-01-01",
                        "Location: United States",
                        "Keyword,Avg. monthly searches,Competition,Top of page bid (low range),Top of page bid (high range)",
                        "batch seed,111,LOW,0.4,0.9",
                    ].join("\n")
                ),
                "gkp-batch.csv"
            )
            .expect(200);

        const response = await request
            .get(apiPath("/signals/batches"))
            .set(headers)
            .expect(200);

        expect(response.body.batches.length).toBeGreaterThan(0);
    });

    it("lists signals for a batch", async () => {
        const headers = await authHeader();
        const importResponse = await request
            .post(apiPath("/signals/upload"))
            .set(headers)
            .attach(
                "file",
                Buffer.from(
                    [
                        "Keyword Stats 2025-01-01",
                        "Location: United States",
                        "Keyword,Avg. monthly searches,Competition,Top of page bid (low range),Top of page bid (high range)",
                        "trend hat,111,LOW,0.4,0.9",
                    ].join("\n")
                ),
                "gkp-inline.csv"
            )
            .expect(200);

        const batchId = importResponse.body.batch.id as string;

        const response = await request
            .get(apiPath(`/signals?batchId=${batchId}`))
            .set(headers)
            .expect(200);

        expect(response.body.signals.length).toBeGreaterThan(0);
        expect(response.body.signals[0].batchId).toBe(batchId);
    });

    it("computes scores and reasons on import", async () => {
        const headers = await authHeader();
        const importResponse = await request
            .post(apiPath("/signals/upload"))
            .set(headers)
            .attach(
                "file",
                Buffer.from(
                    [
                        "Keyword Stats 2025-01-01",
                        "Location: United States",
                        "Keyword,Avg. monthly searches,Competition,Top of page bid (low range),Top of page bid (high range),Three month change,YoY change",
                        "scored keyword,1000,HIGH,1.0,2.0,-90%,20%",
                    ].join("\n")
                ),
                "gkp-score.csv"
            )
            .expect(200);

        const batchId = importResponse.body.batch.id as string;

        const response = await request
            .get(apiPath(`/signals?batchId=${batchId}&sort=score&order=desc`))
            .set(headers)
            .expect(200);

        const [signal] = response.body.signals;
        expect(signal.keyword).toBe("scored keyword");
        expect(signal.score).toBeGreaterThan(5.8);
        expect(signal.score).toBeLessThan(6.1);
        expect(signal.scoreReasons).toContain("V:1k");
        expect(signal.scoreReasons).toContain("C:HIGH");
        expect(signal.scoreReasons).toContain("CPC:$2.00");
        expect(signal.scoreReasons).toContain("3M:-90%");
        expect(signal.scoreReasons).toContain("YoY:+");
    });

    it("returns 400 when keyword column is missing", async () => {
        const headers = await authHeader();

        const response = await request
            .post(apiPath("/signals/upload"))
            .set(headers)
            .attach(
                "file",
                Buffer.from(
                    [
                        "Keyword Stats 2025-01-01",
                        "Location: United States",
                        "Phrase,Avg. monthly searches",
                        "no keyword,123",
                    ].join("\n")
                ),
                "gkp-missing-keyword.csv"
            )
            .expect(400);

        expect(response.body.message).toContain("keyword");
    });

    it("returns 400 when file is missing", async () => {
        const headers = await authHeader();

        await request
            .post(apiPath("/signals/upload"))
            .set(headers)
            .expect(400);
    });
});
