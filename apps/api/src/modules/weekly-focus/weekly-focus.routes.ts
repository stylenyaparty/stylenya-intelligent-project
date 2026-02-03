import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../interfaces/http/middleware/auth";
import { createWeeklyFocusSnapshot } from "./weekly-focus.service";

export async function weeklyFocusRoutes(app: FastifyInstance) {
    app.get("/weekly-focus", { preHandler: requireAuth }, async (request) => {
        const query = request.query as { limit?: string };
        const parsed = query.limit ? Number(query.limit) : undefined;
        const limit = Number.isFinite(parsed) ? parsed : undefined;
        const data = await createWeeklyFocusSnapshot(limit);
        return { ok: true, ...data };
    });
}
