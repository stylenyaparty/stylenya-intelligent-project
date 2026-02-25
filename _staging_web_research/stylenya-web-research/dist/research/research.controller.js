import crypto from "crypto";
import { researchRequestSchema } from "./research.schema.js";
import { runResearchPipeline } from "./research.pipeline.js";
export async function runResearch(request, reply) {
    const parsed = researchRequestSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({
            error: "Invalid request body",
            details: parsed.error.flatten(),
        });
    }
    const body = parsed.data;
    const result = await runResearchPipeline({
        prompt: body.prompt,
        mode: body.mode,
        market: body.market,
        //language: body.language,
        //topic: body.topic,
    });
    return {
        runId: crypto.randomUUID(),
        meta: {
            prompt: body.prompt,
            mode: body.mode,
            market: body.market,
            generatedAt: new Date().toISOString(),
            cache: { hit: false, ttlSeconds: 3600 },
            disclaimer: "Research-based recurrence. Not search volume.",
        },
        ...result,
    };
}
//# sourceMappingURL=research.controller.js.map