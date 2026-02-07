import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../infrastructure/db/prisma";
import { buildDedupeKey } from "../../../modules/decisions/decision-dedupe";
import { getDecisionDateRange } from "../../../modules/decisions/decision-date-range";
import { requireAuth, requireRole } from "../middleware/auth";

const ActionTypeSchema = z.enum(["PROMOTE", "CREATE", "OPTIMIZE", "PAUSE"]);
const DecisionStatusSchema = z.enum(["PLANNED", "EXECUTED", "MEASURED", "CANCELLED"]);
const TargetTypeSchema = z.enum(["KEYWORD", "PRODUCT", "THEME"]);

export async function decisionsRoutes(app: FastifyInstance) {
    // Create decision
    app.post(
        "/decisions",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async (request, reply) => {
            try {
                const BodySchema = z.object({
                    actionType: ActionTypeSchema,
                    targetType: TargetTypeSchema.optional(),
                    targetId: z.string().min(1).optional(),
                    title: z.string().min(3),
                    rationale: z.string().min(3).optional(),
                    priorityScore: z.number().int().optional(),
                    sources: z.array(z.any()).optional(),
                });

                const body = BodySchema.parse(request.body);

                const dedupeKey = buildDedupeKey({
                    actionType: body.actionType,
                    targetType: body.targetType ?? null,
                    targetId: body.targetId ?? null,
                    sources: body.sources ?? [],
                });

                const existing = await prisma.decision.findUnique({ where: { dedupeKey } });
                if (existing) {
                    return reply.code(200).send({ ok: true, decision: existing });
                }

                try {
                    const created = await prisma.decision.create({
                        data: {
                            actionType: body.actionType,
                            targetType: body.targetType,
                            targetId: body.targetId,
                            title: body.title,
                            rationale: body.rationale,
                            priorityScore: body.priorityScore,
                            sources: body.sources ?? undefined,
                            dedupeKey,
                        },
                    });

                    return reply.code(201).send({ ok: true, decision: created });
                } catch (error) {
                    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                        const deduped = await prisma.decision.findUnique({ where: { dedupeKey } });
                        if (deduped) {
                            return reply.code(200).send({ ok: true, decision: deduped });
                        }
                    }
                    throw error;
                }
            } catch (error) {
                console.error("Error creating decision:", error);
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({ error: "Invalid decision payload" });
                }
                return reply.code(500).send({
                    error: error instanceof Error ? error.message : "Failed to create decision",
                });
            }
        }
    );

    // List decisions (most recent first)
    app.get(
        "/decisions",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async (request, reply) => {
            const QuerySchema = z.object({
                limit: z.string().optional(),
                status: DecisionStatusSchema.optional(),
                range: z.enum(["today", "all"]).optional(),
                mode: z.enum(["all"]).optional(),
                date: z.string().optional(),
            });

            const query = QuerySchema.safeParse(request.query);
            if (!query.success) {
                return reply.code(400).send({ error: "Invalid decisions query" });
            }

            const parsedLimit = query.data.limit ? Number(query.data.limit) : undefined;
            const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit!, 1), 100) : 50;

            const where: any = {};
            if (query.data.status) where.status = query.data.status;

            const mode = query.data.mode ?? (query.data.range === "all" ? "all" : "today");
            const dateFilter =
                typeof query.data.date === "string"
                    ? getDecisionDateRange({ date: query.data.date })
                    : mode === "all"
                        ? null
                        : getDecisionDateRange();

            if (query.data.date && !dateFilter) {
                return reply.code(400).send({ error: "Invalid date format" });
            }

            if (dateFilter) {
                where.createdAt = {
                    gte: dateFilter.start,
                    lt: dateFilter.end,
                };
            }

            const rows = await prisma.decision.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
            });

            return { ok: true, limit, decisions: rows };
        }
    );

    app.get(
        "/decisions/:id/expansion",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async (request, reply) => {
            try {
                const ParamsSchema = z.object({ id: z.string().uuid() });
                const params = ParamsSchema.parse(request.params);

                const decision = await prisma.decision.findUnique({ where: { id: params.id } });
                if (!decision) {
                    return reply.code(404).send({
                        ok: false,
                        code: "DECISION_NOT_FOUND",
                        error: "Decision not found",
                    });
                }

                const sources = decision.sources as
                    | {
                          expansion?: {
                              latestExpansionId?: string;
                          };
                      }
                    | null
                    | undefined;

                const expansionId = sources?.expansion?.latestExpansionId;
                if (!expansionId) {
                    return reply.code(404).send({
                        ok: false,
                        code: "EXPANSION_NOT_FOUND",
                        error: "Expansion not found",
                    });
                }

                const expansion = await prisma.decisionDraftExpansion.findUnique({
                    where: { id: expansionId },
                });
                if (!expansion) {
                    return reply.code(404).send({
                        ok: false,
                        code: "EXPANSION_NOT_FOUND",
                        error: "Expansion not found",
                    });
                }

                return reply.send({
                    ok: true,
                    expansion: {
                        id: expansion.id,
                        draftId: expansion.draftId,
                        kind: expansion.kind,
                        createdAt: expansion.createdAt,
                        model: expansion.model,
                        provider: expansion.provider,
                        tokensIn: expansion.tokensIn,
                        tokensOut: expansion.tokensOut,
                        latencyMs: expansion.latencyMs,
                        responseJson: expansion.responseJson,
                        responseRaw: expansion.responseRaw,
                    },
                });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({ error: "Invalid decision expansion request" });
                }
                throw error;
            }
        }
    );

    // Update decision status (and optional notes)
    app.patch(
        "/decisions/:id",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async (request, reply) => {
            try {
                const ParamsSchema = z.object({ id: z.string().uuid() });
                const BodySchema = z.object({
                    status: DecisionStatusSchema.optional(),
                    title: z.string().min(3).optional(),
                    rationale: z.string().min(3).optional(),
                    priorityScore: z.number().int().optional(),
                });

                const params = ParamsSchema.parse(request.params);
                const body = BodySchema.parse(request.body);

                const updated = await prisma.decision.update({
                    where: { id: params.id },
                    data: {
                        status: body.status,
                        title: body.title,
                        rationale: body.rationale,
                        priorityScore: body.priorityScore,
                    },
                });

                return reply.send({ ok: true, decision: updated });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({ error: "Invalid decision update payload" });
                }
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
                    return reply.code(404).send({ error: "Decision not found" });
                }
                throw error;
            }
        }
    );
}
