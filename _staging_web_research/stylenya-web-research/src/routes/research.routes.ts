import type { FastifyInstance } from "fastify";
import { createResearchRunner } from "../jobs/research.runner.js";
import { createRunQueued, createRunRunning, markCancelRequested } from "../services/research.run.service.js";
import { getResearchRun, listResearchRuns } from "../services/research.service.js";

const VALID_STATUSES = new Set(["QUEUED", "RUNNING", "SUCCESS", "FAILED"]);

export async function researchRoutes(app: FastifyInstance) {
    const runner = createResearchRunner(app.log);

    app.addHook("onClose", async () => {
        await runner.shutdown();
    });

    app.post("/v1/research/web", async (request, reply) => {
        const body = request.body as {
            query?: string;
            mode?: "quick" | "deep";
            locale?: string;
            geo?: string;
            language?: string;
            market?: string;
            topic?: "seasonal" | "product" | "supplier" | "general";
        };

        if (!body?.query || !body.query.trim()) {
            return reply.status(400).send({ error: "query is required" });
        }

        const mode = body.mode ?? "quick";
        const asyncEnabled = String(process.env.RESEARCH_ASYNC_ENABLED ?? "true") !== "false";

        if (!asyncEnabled) {
            const run = await createRunRunning({
                query: body.query,
                mode,
                ...(body.locale ? { locale: body.locale } : {}),
                ...(body.geo ? { geo: body.geo } : {}),
                ...(body.language ? { language: body.language } : {}),
            });

            const jobInput = {
                query: body.query,
                mode,
                ...(body.market ? { market: body.market } : {}),
                ...(body.locale ? { locale: body.locale } : {}),
                ...(body.geo ? { geo: body.geo } : {}),
                ...(body.language ? { language: body.language } : {}),
                ...(body.topic ? { topic: body.topic } : {}),
            };

            runner.enqueueResearchRun(run.id, jobInput);

            return reply.status(202).send({ runId: run.id, status: "RUNNING" });
        }

        const run = await createRunQueued({
            query: body.query,
            mode,
            ...(body.locale ? { locale: body.locale } : {}),
            ...(body.geo ? { geo: body.geo } : {}),
            ...(body.language ? { language: body.language } : {}),
        });

        const jobInput = {
            query: body.query,
            mode,
            ...(body.market ? { market: body.market } : {}),
            ...(body.locale ? { locale: body.locale } : {}),
            ...(body.geo ? { geo: body.geo } : {}),
            ...(body.language ? { language: body.language } : {}),
            ...(body.topic ? { topic: body.topic } : {}),
        };

        runner.enqueueResearchRun(run.id, jobInput);

        return reply.status(202).send({ runId: run.id, status: "QUEUED" });
    });

    app.get("/v1/research/runs", async (request, reply) => {
        const query = request.query as {
            page?: string | number;
            pageSize?: string | number;
            status?: string;
            query?: string;
        };

        const page = Math.max(1, Number(query.page ?? 1) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20) || 20));
        const status = typeof query.status === "string" && VALID_STATUSES.has(query.status) ? query.status : undefined;

        if (query.status && !status) {
            return reply.status(400).send({ error: "Invalid status" });
        }

        const result = await listResearchRuns({
            page,
            pageSize,
            ...(status ? { status: status as "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" } : {}),
            ...(typeof query.query === "string" ? { query: query.query } : {}),
        });

        return {
            page,
            pageSize,
            total: result.total,
            items: result.items,
        };
    });

    app.get("/v1/research/runs/:id", async (request, reply) => {
        const { id } = request.params as { id: string };

        const run = await getResearchRun(id);

        if (!run) {
            return reply.status(404).send({ error: "Run not found" });
        }

        return { ...run, clusters: run.clusters ?? [], rows: run.rows ?? [] };
    });

    app.post("/v1/research/runs/:id/cancel", async (request, reply) => {
        const { id } = request.params as { id: string };
        const run = await getResearchRun(id);
        if (!run) return reply.status(404).send({ error: "Run not found" });

        await markCancelRequested(id);
        const result = await runner.cancel(id);

        return {
            runId: id,
            status: run.status,
            cancelRequested: true,
            cancelled: result.cancelled,
        };
    });
}
