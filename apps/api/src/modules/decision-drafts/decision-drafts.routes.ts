import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../interfaces/http/middleware/auth";
import { isAppError } from "../../types/app-error.js";
import {
    createDecisionDrafts,
    dismissDecisionDraft,
    expandDecisionDraftById,
    listDecisionDrafts,
    listDecisionDraftExpansions,
    promoteDecisionDraft,
} from "./decision-drafts.service.js";

export async function decisionDraftRoutes(app: FastifyInstance) {
    app.post(
        "/decision-drafts/generate",
        { preHandler: requireAuth },
        async (request, reply) => {
            const QuerySchema = z.object({
                batchId: z.string().optional(),
            });
            const parsed = QuerySchema.safeParse(request.query ?? {});
            if (!parsed.success) {
                return reply.code(400).send({ error: "Invalid request" });
            }

            try {
                const drafts = await createDecisionDrafts(parsed.data);
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

    app.get("/decision-drafts", { preHandler: requireAuth }, async (request, reply) => {
        const QuerySchema = z.object({
            date: z.string().optional(),
            status: z.enum(["NEW", "DISMISSED", "PROMOTED", "ALL"]).optional(),
        });
        const parsed = QuerySchema.safeParse(request.query ?? {});
        if (!parsed.success) {
            return reply.code(400).send({ error: "Invalid decision drafts query" });
        }

        try {
            const drafts = await listDecisionDrafts({
                date: parsed.data.date,
                status: parsed.data.status ?? "NEW",
            });
            return reply.send({ ok: true, drafts });
        } catch (error) {
            if (isAppError(error)) {
                return reply
                    .code(error.statusCode)
                    .send({ code: error.code, message: error.message });
            }
            throw error;
        }
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

    app.post(
        "/decision-drafts/:id/expand",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async (request, reply) => {
            const params = request.params as { id: string };
            const BodySchema = z.object({
                focus: z.string().optional(),
                kind: z.enum(["EXPAND", "REFORMULATE", "RERUN"]).optional(),
            });
            const parsed = BodySchema.safeParse(request.body ?? {});
            if (!parsed.success) {
                return reply.code(400).send({ error: "Invalid request" });
            }

            try {
                const result = await expandDecisionDraftById({
                    id: params.id,
                    focus: parsed.data.focus,
                    kind: parsed.data.kind,
                });
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

    app.get(
        "/decision-drafts/:id/expansions",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async (request, reply) => {
            const params = request.params as { id: string };
            try {
                const items = await listDecisionDraftExpansions(params.id);
                return reply.send({ ok: true, items });
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
