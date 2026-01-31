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
    updateKeywordSeedStatus,
} from "./keywords.service";
import { runKeywordJob } from "./keywords-runner.service";

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
                return reply.code(500).send({ error: "Keyword research failed" });
            }
        }
    );
}
