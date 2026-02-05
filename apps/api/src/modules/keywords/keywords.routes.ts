import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../interfaces/http/middleware/auth";
import { requireLegacyEnabled } from "../../interfaces/http/middleware/legacy";
import {
    keywordJobCreateSchema,
    keywordJobListQuerySchema,
    keywordSeedCreateSchema,
    keywordSeedListQuerySchema,
    keywordSeedStatusSchema,
} from "./keywords.schemas";
import {
    archiveKeywordJob,
    countActiveKeywordSeeds,
    createKeywordJob,
    createKeywordSeeds,
    getKeywordJob,
    listKeywordJobItems,
    listKeywordJobs,
    listKeywordSeeds,
    listPromotedKeywordSignals,
    promoteKeywordJobItem,
    restoreKeywordJob,
    updateKeywordSeedStatus,
} from "./keywords.service";
import { runKeywordJob } from "./keywords-runner.service";
import { isAppError } from "../../types/app-error.js";

export async function keywordsRoutes(app: FastifyInstance) {
    const legacyPreHandler = [requireAuth, requireLegacyEnabled];

    app.get("/keyword-seeds/count", { preHandler: legacyPreHandler }, async () => {
        const count = await countActiveKeywordSeeds();
        return { count };
    });

    app.post("/keywords/seeds", { preHandler: legacyPreHandler }, async (request, reply) => {
        try {
            const body = keywordSeedCreateSchema.parse(request.body);
            const result = await createKeywordSeeds(body);
            return reply.code(201).send({ ok: true, ...result });
        } catch (error) {
            return reply.code(400).send({ error: "Invalid seed payload" });
        }
    });

    app.get("/keywords/seeds", { preHandler: legacyPreHandler }, async (request) => {
        const query = keywordSeedListQuerySchema.safeParse(request.query);
        const status = query.success ? query.data.status : undefined;
        const seeds = await listKeywordSeeds(status);
        return { ok: true, seeds };
    });

    app.patch(
        "/keywords/seeds/:id",
        { preHandler: legacyPreHandler },
        async (request, reply) => {
        try {
            const params = request.params as { id: string };
            const body = keywordSeedStatusSchema.parse((request.body as { status: string }).status);
            const seed = await updateKeywordSeedStatus(params.id, body);
            return reply.send({ ok: true, seed });
        } catch (error) {
            return reply.code(400).send({ error: "Invalid seed update payload" });
        }
    });

    app.post("/keywords/jobs", { preHandler: legacyPreHandler }, async (request, reply) => {
        try {
            const parsed = keywordJobCreateSchema.safeParse(request.body);
            if (!parsed.success) {
                const rawMode = (request.body as { mode?: string } | undefined)?.mode;
                if (rawMode === "AI") {
                    return reply.code(400).send({
                        code: "INVALID_JOB_MODE",
                        message: "AI mode is not supported for keyword jobs.",
                    });
                }
                return reply.code(400).send({ error: "Invalid keyword job payload" });
            }
            const body = parsed.data;
            if (body.mode === "AUTO" || body.mode === "HYBRID") {
                const activeSeedCount = await countActiveKeywordSeeds();
                if (activeSeedCount === 0) {
                    return reply.code(409).send({
                        code: "SEEDS_REQUIRED",
                        message:
                            "Create seed keywords before creating or running an AUTO/HYBRID job.",
                    });
                }
            }
            const result = await createKeywordJob(body);
            return reply.code(201).send({ ok: true, ...result });
        } catch (error) {
            if (isAppError(error)) {
                return reply
                    .code(error.statusCode)
                    .send({ code: error.code, message: error.message });
            }
            const message =
                error instanceof Error ? error.message : "Invalid keyword job payload";
            return reply.code(400).send({ error: message });
        }
    });

    app.get("/keywords/jobs", { preHandler: legacyPreHandler }, async (request, reply) => {
        const query = keywordJobListQuerySchema.safeParse(request.query);
        if (!query.success) {
            return reply.code(400).send({ error: "Invalid job list query" });
        }
        const status = query.data.status ?? "active";
        const jobs = await listKeywordJobs(status);
        return reply.send({ ok: true, jobs });
    });

    app.get("/keywords/jobs/:id", { preHandler: legacyPreHandler }, async (request, reply) => {
        const params = request.params as { id: string };
        const job = await getKeywordJob(params.id);
        if (!job) {
            return reply.code(404).send({ error: "Job not found" });
        }
        return reply.send({ ok: true, job });
    });

    app.get(
        "/keywords/jobs/:id/items",
        { preHandler: legacyPreHandler },
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
        { preHandler: legacyPreHandler },
        async (request, reply) => {
            const params = request.params as { id: string };
            const query = request.query as { force?: string | boolean };
            const forceRun =
                query?.force === true ||
                (typeof query?.force === "string" && query.force.toLowerCase() === "true");
            try {
                const result = await runKeywordJob(params.id, { force: forceRun });
                if (!result) {
                    return reply.code(404).send({ error: "Job not found" });
                }
                return reply.send({ ok: true, ...result });
            } catch (error) {
                request.log.error({ err: error }, "keywords job run failed");
                if (isAppError(error)) {
                    return reply
                        .code(error.statusCode)
                        .send({ code: error.code, message: error.message });
                }
                return reply
                    .code(500)
                    .send({ error: "INTERNAL_SERVER_ERROR", message: "Keyword research failed" });
            }
        }
    );

    app.post(
        "/keywords/jobs/:id/archive",
        { preHandler: legacyPreHandler },
        async (request, reply) => {
            const params = request.params as { id: string };
            const job = await getKeywordJob(params.id);
            if (!job) {
                return reply.code(404).send({ error: "Job not found" });
            }
            if (job.archivedAt) {
                return reply.code(409).send({ error: "Job already archived" });
            }
            if (job.status === "RUNNING") {
                return reply
                    .code(409)
                    .send({ error: "Job is running and cannot be archived" });
            }

            const updated = await archiveKeywordJob(params.id);
            return reply.send({ ok: true, job: updated });
        }
    );

    app.post(
        "/keywords/jobs/:id/restore",
        { preHandler: legacyPreHandler },
        async (request, reply) => {
            const params = request.params as { id: string };
            const job = await getKeywordJob(params.id);
            if (!job) {
                return reply.code(404).send({ error: "Job not found" });
            }
            if (!job.archivedAt) {
                return reply.code(409).send({ error: "Job is not archived" });
            }

            const updated = await restoreKeywordJob(params.id);
            return reply.send({ ok: true, job: updated });
        }
    );

    app.post(
        "/keywords/job-items/:id/promote",
        { preHandler: legacyPreHandler },
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

    app.get("/keywords/promoted", { preHandler: legacyPreHandler }, async () => {
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
