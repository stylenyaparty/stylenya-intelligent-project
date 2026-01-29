import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../infrastructure/db/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const DecisionTypeSchema = z.enum(["MIGRATE", "BOOST", "KEEP", "PAUSE", "RETIRE", "LAUNCH", "PROMOTE"]);
const DecisionStatusSchema = z.enum(["PLANNED", "EXECUTED", "MEASURED", "CANCELLED"]);

export async function decisionsRoutes(app: FastifyInstance) {
    // Create decision
    app.post(
        "/decisions",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async (request, reply) => {
            const BodySchema = z.object({
                productId: z.string().uuid(),
                decisionType: DecisionTypeSchema,
                rationale: z.string().min(3),
                expectedImpact: z.string().min(1).optional(),
                engineVersion: z.string().optional(),
                engineSnapshot: z.any().optional(), // puedes enviar el item del weekly-focus completo
            });

            const body = BodySchema.parse(request.body);

            // (Opcional) validar que product exista
            const exists = await prisma.product.findUnique({
                where: { id: body.productId },
                select: { id: true },
            });
            if (!exists) return reply.code(404).send({ ok: false, error: "Product not found" });

            const created = await prisma.decision.create({
                data: {
                    productId: body.productId,
                    decisionType: body.decisionType,
                    rationale: body.rationale,
                    expectedImpact: body.expectedImpact,
                    engineVersion: body.engineVersion ?? "v1",
                    engineSnapshot: body.engineSnapshot ?? undefined,
                },
            });

            return reply.code(201).send({ ok: true, decision: created });
        }
    );

    // List decisions (most recent first)
    app.get(
        "/decisions",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async (request) => {
            const q = request.query as { limit?: string; productId?: string; status?: string };

            const parsedLimit = q.limit ? Number(q.limit) : undefined;
            const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit!, 1), 100) : 50;

            const where: any = {};
            if (q.productId) where.productId = q.productId;
            if (q.status) where.status = DecisionStatusSchema.parse(q.status);

            const rows = await prisma.decision.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                include: {
                    product: { select: { id: true, name: true, shopifyProductId: true, etsyListingId: true } },
                },
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
                rationale: z.string().min(3).optional(),
                expectedImpact: z.string().min(1).optional(),
            });

            const params = ParamsSchema.parse(request.params);
            const body = BodySchema.parse(request.body);

            const updated = await prisma.decision.update({
                where: { id: params.id },
                data: {
                    status: body.status,
                    rationale: body.rationale,
                    expectedImpact: body.expectedImpact,
                },
            });

            return reply.send({ ok: true, decision: updated });
        }
    );
}
