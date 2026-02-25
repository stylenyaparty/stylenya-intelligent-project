import { z } from "zod";

export const webResearchBodySchema = z.object({
    query: z.string().trim().min(1),
    mode: z.enum(["quick", "deep"]).default("quick"),
    market: z.string().trim().min(2).optional(),
    locale: z.string().trim().min(2).optional(),
    geo: z.string().trim().min(2).optional(),
    language: z.string().trim().min(2).optional(),
    topic: z.enum(["seasonal", "product", "supplier", "general"]).optional(),
});

export const webResearchRunParamsSchema = z.object({
    id: z.string().trim().min(1),
});
