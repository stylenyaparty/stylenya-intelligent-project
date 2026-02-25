import { z } from "genkit";
import { ai } from "../index.js";
import { runResearchPipeline } from "../research/research.pipeline.js";

const webResearchInputSchema = z.object({
    prompt: z.string().min(1),
    mode: z.enum(["quick", "deep"]),
    market: z.string().min(1),
    language: z.string().optional(),
    topic: z.enum(["seasonal", "product", "supplier", "general"]).optional(),
});

type WebResearchInput = z.infer<typeof webResearchInputSchema>;

function stripUndefined<T extends Record<string, unknown>>(obj: T) {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined)
    ) as {
            [K in keyof T as T[K] extends undefined ? never : K]: Exclude<T[K], undefined>;
        };
}

export const webResearchFlow = ai.defineFlow(
    {
        name: "webResearchFlow",
        inputSchema: webResearchInputSchema,
        outputSchema: z.any(),
    },
    async (input: WebResearchInput) => {
        const normalized = stripUndefined(input);
        // Remove 'language' if it's undefined, otherwise ensure it's a string or null
        if (normalized.language === undefined || normalized.language === null) {
            delete (normalized as any).language;
        }
        return runResearchPipeline(normalized as WebResearchInput);
    }
);