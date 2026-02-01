import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../interfaces/http/middleware/auth";
import {
    keywordJobCreateSchema,
    keywordSeedCreateSchema,
    keywordSeedListQuerySchema,
    keywordSeedStatusSchema,
} from "./keywords.schemas";
import {
    createKeywordJob,
    createKeywordSeeds,
    getKeywordJob,
    listKeywordJobItems,
    listKeywordJobs,
    listKeywordSeeds,
    listPromotedKeywordSignals,
    promoteKeywordJobItem,
    updateKeywordSeedStatus,
} from "./keywords.service";
import { isKeywordJobRunError, runKeywordJob } from "./keywords-runner.service";

export async function keywordsRoutes(app: FastifyInstance) {
    app.post("/keywords/seeds", { preHandler: requireAuth }, async (request, reply) => {
        try {
            const body = keywordSeedCreateSchema.parse(request.body);
            const result = await createKeywordSeeds(body);
            return reply.code(201).send({ ok: true, ...result });
        } catch (error) {
            return reply.code(400).send({ error: "Invalid seed payload" });
        }
    });

    app.get("/keywords/seeds", { preHandler: requireAuth }, async (request) => {
        const query = keywordSeedListQuerySchema.safeParse(request.query);
        const status = query.success ? query.data.status : undefined;
        const seeds = await listKeywordSeeds(status);
        return { ok: true, seeds };
    });

    app.patch("/keywords/seeds/:id", { preHandler: requireAuth }, async (request, reply) => {
        try {
            const params = request.params as { id: string };
            const body = keywordSeedStatusSchema.parse((request.body as { status: string }).status);
            const seed = await updateKeywordSeedStatus(params.id, body);
            return reply.send({ ok: true, seed });
        } catch (error) {
            return reply.code(400).send({ error: "Invalid seed update payload" });
        }
    });

    app.post("/keywords/jobs", { preHandler: requireAuth }, async (request, reply) => {
        try {
            const body = keywordJobCreateSchema.parse(request.body);
            if (body.mode === "AI" && !body.topic) {
                return reply.code(400).send({ error: "Topic is required for AI mode." });
            }
            const result = await createKeywordJob(body);
            return reply.code(201).send({ ok: true, ...result });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Invalid keyword job payload";
            return reply.code(400).send({ error: message });
        }
    });

    app.get("/keywords/jobs", { preHandler: requireAuth }, async () => {
        const jobs = await listKeywordJobs();
        return { ok: true, jobs };
    });

    app.get("/keywords/jobs/:id", { preHandler: requireAuth }, async (request, reply) => {
        const params = request.params as { id: string };
        const job = await getKeywordJob(params.id);
        if (!job) {
            return reply.code(404).send({ error: "Job not found" });
        }
        return reply.send({ ok: true, job });
    });

    app.get(
        "/keywords/jobs/:id/items",
        { preHandler: requireAuth },
        async (request, reply) => {
            const params = request.params as { id: string };
            const job = await getKeywordJob(params.id);
            if (!job) {
                return reply.code(404).send({ error: "Job not found" });
            }
            const items = await listKeywordJobItems(params.id);
            return reply.send({ ok: true, items });
        }
    );

    app.post(
        "/keywords/jobs/:id/run",
        { preHandler: requireAuth },
        async (request, reply) => {
            const params = request.params as { id: string };
            try {
                const result = await runKeywordJob(params.id);
                if (!result) {
                    return reply.code(404).send({ error: "Job not found" });
                }
                return reply.send({ ok: true, ...result });
            } catch (error) {
                request.log.error({ err: error }, "keywords job run failed");
                if (isKeywordJobRunError(error)) {
                    return reply
                        .code(error.statusCode)
                        .send({ error: error.code, message: error.message });
                }
                return reply
                    .code(500)
                    .send({ error: "INTERNAL_SERVER_ERROR", message: "Keyword research failed" });
            }
        }
    );

    app.post(
        "/keywords/job-items/:id/promote",
        { preHandler: requireAuth },
        async (request, reply) => {
            const params = request.params as { id: string };
            const result = await promoteKeywordJobItem(params.id);
            if (!result) {
                return reply.code(404).send({ error: "Job item not found" });
            }

            const payload = {
                promoted: true,
                signalId: result.signal.id,
                keyword: result.signal.keyword,
                priority: result.signal.priority,
                promotedAt: result.signal.promotedAt,
            };

            return reply.code(result.created ? 201 : 200).send(payload);
        }
    );

    app.get("/keywords/promoted", { preHandler: requireAuth }, async () => {
        const signals = await listPromotedKeywordSignals();
        return {
            ok: true,
            signals: signals.map((signal) => ({
                id: signal.id,
                jobItemId: signal.jobItemId,
                keyword: signal.keyword,
                engine: signal.engine,
                language: signal.language,
                country: signal.country,
                priority: signal.priority,
                promotedAt: signal.promotedAt,
                interestScore: signal.interestScore,
                competitionScore: signal.competitionScore,
            })),
        };
    });
}
