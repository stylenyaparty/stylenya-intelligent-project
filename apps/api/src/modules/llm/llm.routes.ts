import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../interfaces/http/middleware/auth";
import { LLMNotConfiguredError } from "./llm.errors";
import { suggestKeywords } from "./suggest-keywords.service";

const suggestKeywordsSchema = z.object({
    topic: z.string().min(1),
    max: z.number().int().min(1).max(50).optional(),
});

export async function llmRoutes(app: FastifyInstance) {
    app.post("/ai/suggest-keywords", { preHandler: requireAuth }, async (request, reply) => {
        const parsed = suggestKeywordsSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Invalid request" });
        }

        try {
            const max = parsed.data.max ?? 10;
            const keywords = await suggestKeywords(parsed.data.topic, max);
            return { ok: true, keywords };
        } catch (error) {
            if (error instanceof LLMNotConfiguredError) {
                return reply
                    .code(400)
                    .send({ errorCode: "LLM_NOT_CONFIGURED", message: error.message });
            }
            return reply
                .code(500)
                .send({ errorCode: "LLM_PROVIDER_ERROR", message: "LLM provider error" });
        }
    });
}
