import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../interfaces/http/middleware/auth";
import { getLLMProvider } from "./get-llm-provider";

const suggestKeywordsSchema = z.object({
    topic: z.string().min(1),
    max: z.number().int().min(1).max(50).optional(),
});

function parseKeywords(text: string, max: number) {
    let parts = text.split("\n").map((entry) => entry.trim()).filter(Boolean);
    if (parts.length === 1 && parts[0].includes(",")) {
        parts = parts[0].split(",").map((entry) => entry.trim()).filter(Boolean);
    }

    const seen = new Set<string>();
    const keywords: string[] = [];

    for (const part of parts) {
        const key = part.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        keywords.push(part);
        if (keywords.length >= max) break;
    }

    return keywords;
}

export async function llmRoutes(app: FastifyInstance) {
    app.post("/ai/suggest-keywords", { preHandler: requireAuth }, async (request, reply) => {
        const parsed = suggestKeywordsSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Invalid request" });
        }

        const max = parsed.data.max ?? 10;
        const provider = getLLMProvider();
        const system =
            "You generate SEO keyword suggestions for e-commerce. Return one keyword per line. No numbering.";
        const user = `Topic: ${parsed.data.topic}. Return ${max} keyword suggestions.`;

        try {
            const { text } = await provider.generateText({
                system,
                user,
                temperature: 0.3,
                maxTokens: 300,
            });
            const keywords = parseKeywords(text, max);
            return { ok: true, keywords };
        } catch {
            return reply.code(500).send({ error: "LLM provider error" });
        }
    });
}
