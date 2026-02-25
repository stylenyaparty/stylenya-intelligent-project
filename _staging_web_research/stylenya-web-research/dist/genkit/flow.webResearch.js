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
function stripUndefined(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}
export const webResearchFlow = ai.defineFlow({
    name: "webResearchFlow",
    inputSchema: webResearchInputSchema,
    outputSchema: z.any(),
}, async (input) => {
    const normalized = stripUndefined(input);
    // Remove 'language' if it's undefined, otherwise ensure it's a string or null
    if (normalized.language === undefined || normalized.language === null) {
        delete normalized.language;
    }
    return runResearchPipeline(normalized);
});
//# sourceMappingURL=flow.webResearch.js.map