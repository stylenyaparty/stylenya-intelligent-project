import { z } from "zod";

export const researchRequestSchema = z.object({
    prompt: z
        .string()
        .min(8, "Prompt must be at least 8 characters.")
        .max(500, "Prompt too long."),
    mode: z.enum(["quick", "deep"]),
    market: z.string().min(2).default("US"),
    language: z.string().optional().default("en"),
    topic: z
        .enum(["seasonal", "product", "supplier", "general"])
        .optional()
});