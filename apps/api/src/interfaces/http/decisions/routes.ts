import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../infrastructure/db/prisma";
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

                const created = await prisma.decision.create({
                    data: {
                        actionType: body.actionType,
                        targetType: body.targetType,
                        targetId: body.targetId,
                        title: body.title,
                        rationale: body.rationale,
                        priorityScore: body.priorityScore,
                        sources: body.sources ?? undefined,
                        productId: undefined,
                    },
                });

                return reply.code(201).send({ ok: true, decision: created });
            } catch (error) {
                console.error("Error creating decision:", error);
                return reply.code(500).send({ 
                    error: error instanceof Error ? error.message : "Failed to create decision" 
                });
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
