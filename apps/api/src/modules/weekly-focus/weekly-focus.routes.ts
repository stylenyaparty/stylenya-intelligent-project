import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../interfaces/http/middleware/auth";
import { requireLegacyEnabled } from "../../interfaces/http/middleware/legacy";
import { createWeeklyFocusSnapshot } from "./weekly-focus.service";

export async function weeklyFocusRoutes(app: FastifyInstance) {
    const legacyPreHandler = [requireAuth, requireLegacyEnabled];
    const handler = async (request: { query: unknown }) => {
        const query = request.query as { limit?: string };
        const parsed = query.limit ? Number(query.limit) : undefined;
        const limit = Number.isFinite(parsed) ? parsed : undefined;
        const data = await createWeeklyFocusSnapshot(limit);
        return { ok: true, ...data };
    };

    app.get("/weekly-focus", { preHandler: legacyPreHandler }, handler);
    app.get("/v1/weekly-focus", { preHandler: legacyPreHandler }, handler);
}
