import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../interfaces/http/middleware/auth";
import { isAppError } from "../../types/app-error.js";
import {
    createDecisionDrafts,
    dismissDecisionDraft,
    listDecisionDrafts,
    promoteDecisionDraft,
} from "./decision-drafts.service.js";

export async function decisionDraftRoutes(app: FastifyInstance) {
    app.post(
        "/weekly-focus/:id/drafts/generate",
        { preHandler: requireAuth },
        async (request, reply) => {
            const params = request.params as { id: string };
            const BodySchema = z.object({ maxDrafts: z.coerce.number().int().optional() }); // <-- coerce helps
            const parsed = BodySchema.safeParse(request.body ?? {});
            if (!parsed.success) {
                return reply.code(400).send({ error: "Invalid request" });
            }

            const requested = parsed.data.maxDrafts ?? 3;
            const maxDrafts = Math.min(Math.max(requested, 1), 5);

            try {
                const drafts = await createDecisionDrafts(params.id, maxDrafts);
                return reply.code(201).send({ ok: true, drafts });
            } catch (error) {
                // 🔥 ALWAYS log the real error
                request.log.error({ err: error }, "drafts.generate failed");

                if (isAppError(error)) {
                    return reply
                        .code(error.statusCode)
                        .send({ code: error.code, message: error.message, details: error.details });
                }

                // ✅ Map unknown upstream/LLM errors to a clean 503 (not 502)
                return reply.code(503).send({
                    code: "LLM_UPSTREAM_FAILED",
                    message: "LLM provider unavailable. Try again later.",
                    retryAfterSeconds: 60,
                });
            }
        }
    );

    app.get("/weekly-focus/:id/drafts", { preHandler: requireAuth }, async (request, reply) => {
        const params = request.params as { id: string };
        const query = request.query as { status?: string };
        const status = query.status === "all" ? "all" : "active";
        const drafts = await listDecisionDrafts(params.id, status);
        return reply.send({ ok: true, drafts });
    });

    app.post(
        "/decision-drafts/:id/dismiss",
        { preHandler: requireAuth },
        async (request, reply) => {
            const params = request.params as { id: string };
            try {
                const draft = await dismissDecisionDraft(params.id);
                return reply.send({ ok: true, draft });
            } catch (error) {
                if (isAppError(error)) {
                    return reply
                        .code(error.statusCode)
                        .send({ code: error.code, message: error.message });
                }
                throw error;
            }
        }
    );

    app.post(
        "/decision-drafts/:id/promote",
        { preHandler: requireAuth },
        async (request, reply) => {
            const params = request.params as { id: string };
            try {
                const result = await promoteDecisionDraft(params.id);
                return reply.send({ ok: true, ...result });
            } catch (error) {
                if (isAppError(error)) {
                    return reply
                        .code(error.statusCode)
                        .send({ code: error.code, message: error.message });
                }
                throw error;
            }
        }
    );
}
