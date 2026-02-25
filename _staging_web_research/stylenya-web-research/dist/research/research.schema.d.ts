import { z } from "zod";
export declare const researchRequestSchema: z.ZodObject<{
    prompt: z.ZodString;
    mode: z.ZodEnum<["quick", "deep"]>;
    market: z.ZodDefault<z.ZodString>;
    language: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    topic: z.ZodOptional<z.ZodEnum<["seasonal", "product", "supplier", "general"]>>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    mode: "quick" | "deep";
    market: string;
    language: string;
    topic?: "seasonal" | "product" | "supplier" | "general" | undefined;
}, {
    prompt: string;
    mode: "quick" | "deep";
    market?: string | undefined;
    language?: string | undefined;
    topic?: "seasonal" | "product" | "supplier" | "general" | undefined;
}>;
//# sourceMappingURL=research.schema.d.ts.map