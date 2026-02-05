import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../interfaces/http/middleware/auth";
import { isAppError } from "../../types/app-error.js";
import { generateSandboxDrafts, getLLMStatus } from "./llm.service";

export async function llmRoutes(app: FastifyInstance) {
    app.get("/llm/status", { preHandler: requireAuth }, async () => {
        const status = getLLMStatus();
        return { ok: true, ...status };
    });

    const sandboxSchema = z.object({
        signals: z
            .array(
                z.object({
                    term: z.string().min(1),
                    avgMonthlySearches: z.number().int().nonnegative().optional(),
                    competition: z.string().min(1).optional(),
                })
            )
            .min(1)
            .max(20),
        seeds: z.array(z.string().min(1)).optional(),
        context: z.string().min(1).optional(),
    });

    app.post(
        "/llm/sandbox",
        { preHandler: requireAuth },
        async (request, reply) => {
            try {
                const body = sandboxSchema.parse(request.body);
                const result = await generateSandboxDrafts(body);
                request.log.info(
                    { usage: result.usage, elapsedMs: result.meta.elapsedMs },
                    "LLM sandbox succeeded"
                );
                return reply.code(200).send(result);
            } catch (error) {
                if (isAppError(error)) {
                    return reply
                        .code(error.statusCode)
                        .send({ code: error.code, message: error.message });
                }
                return reply.code(400).send({
                    code: "INVALID_SANDBOX_PAYLOAD",
                    message: "Invalid LLM sandbox payload.",
                });
            }
        }
    );
}
