import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../infrastructure/db/prisma";
import { buildDedupeKey } from "../../../modules/decisions/decision-dedupe";
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
            }
        }
    );

    // List decisions (most recent first)
    app.get(
        "/decisions",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async (request) => {
            const q = request.query as { limit?: string; status?: string };

            const parsedLimit = q.limit ? Number(q.limit) : undefined;
            const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit!, 1), 100) : 50;

            const where: any = {};
            if (q.status) where.status = DecisionStatusSchema.parse(q.status);

            const rows = await prisma.decision.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
            });

            return { ok: true, limit, decisions: rows };
        }
    );

    // Update decision status (and optional notes)
    app.patch(
        "/decisions/:id",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async (request, reply) => {
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
        }
    );
}
