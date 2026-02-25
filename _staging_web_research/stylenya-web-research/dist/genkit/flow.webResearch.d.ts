import { z } from "genkit";
export declare const webResearchFlow: import("genkit").Action<z.ZodObject<{
    prompt: z.ZodString;
    mode: z.ZodEnum<["quick", "deep"]>;
    market: z.ZodString;
    language: z.ZodOptional<z.ZodString>;
    topic: z.ZodOptional<z.ZodEnum<["seasonal", "product", "supplier", "general"]>>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    mode: "quick" | "deep";
    market: string;
    language?: string | undefined;
    topic?: "seasonal" | "product" | "supplier" | "general" | undefined;
}, {
    prompt: string;
    mode: "quick" | "deep";
    market: string;
    language?: string | undefined;
    topic?: "seasonal" | "product" | "supplier" | "general" | undefined;
}>, z.ZodAny, z.ZodTypeAny>;
//# sourceMappingURL=flow.webResearch.d.ts.map