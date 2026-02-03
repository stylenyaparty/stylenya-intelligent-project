import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../interfaces/http/middleware/auth";
import { getLLMStatus } from "./llm.service";

export async function llmRoutes(app: FastifyInstance) {
    app.get("/llm/status", { preHandler: requireAuth }, async () => {
        const status = getLLMStatus();
        return { ok: true, ...status };
    });
}
