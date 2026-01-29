import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../middleware/auth";
import { RecommendWeeklyFocusUseCase } from "../../../application/use-cases/recommend-weekly-focus.js";

export async function recommendationsRoutes(app: FastifyInstance) {
    const recommendWeeklyFocus = new RecommendWeeklyFocusUseCase();

    app.get(
        "/recommendations/weekly-focus",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async (req, reply) => {
            const q = req.query as { limit?: string };
            const parsed = q.limit ? Number(q.limit) : undefined;
            const limit = Number.isFinite(parsed) ? parsed : undefined;

            const data = await recommendWeeklyFocus.executeDetailed({ limit });

            return reply.send({ ok: true, ...data });
        }
    );
}
