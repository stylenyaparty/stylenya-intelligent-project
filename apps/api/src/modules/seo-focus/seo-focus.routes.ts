import type { DecisionStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../infrastructure/db/prisma";
import { requireAuth } from "../../interfaces/http/middleware/auth";

const QuerySchema = z.object({
    days: z.coerce.number().int().min(1).max(60).optional(),
    includeExecuted: z
        .union([z.literal("true"), z.literal("false")])
        .optional()
        .transform((value) => (value === undefined ? undefined : value === "true")),
});

export async function seoFocusRoutes(app: FastifyInstance) {
    app.get("/seo-focus", { preHandler: [requireAuth] }, async (request, reply) => {
        const parsed = QuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Invalid seo focus query" });
        }

        const days = parsed.data.days ?? 14;
        const includeExecuted = parsed.data.includeExecuted ?? true;

        const to = new Date();
        const from = new Date(to);
        from.setDate(from.getDate() - (days - 1));

        const statuses: DecisionStatus[] = includeExecuted
            ? ["PLANNED", "EXECUTED"]
            : ["PLANNED"];

        const items = await prisma.decision.findMany({
            where: {
                createdAt: {
                    gte: from,
                    lte: to,
                },
                status: {
                    in: statuses,
                },
            },
            orderBy: [
                {
                    priorityScore: {
                        sort: "desc",
                        nulls: "last",
                    },
                },
                { createdAt: "desc" },
            ],
        });

        return {
            window: {
                from: from.toISOString(),
                to: to.toISOString(),
                days,
                includeExecuted,
            },
            items,
        };
    });
}
