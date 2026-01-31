import { z } from "zod";

export const keywordSeedCreateSchema = z.object({
    terms: z.array(z.string()).min(1),
    tags: z.any().optional(),
});

export const keywordSeedStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);

export const keywordSeedListQuerySchema = z.object({
    status: keywordSeedStatusSchema.optional(),
});

export const keywordJobModeSchema = z.enum(["CUSTOM", "AUTO", "HYBRID", "AI"]);
export const keywordMarketplaceSchema = z.enum(["ETSY", "SHOPIFY", "GOOGLE"]);
export const keywordLanguageSchema = z.enum(["EN", "ES"]);

export const keywordJobCreateSchema = z.object({
    mode: keywordJobModeSchema,
    marketplace: keywordMarketplaceSchema,
    language: keywordLanguageSchema,
    niche: z.string().min(1).optional(),
    topic: z.string().min(1).optional(),
    max: z.number().int().min(1).max(50).optional(),
    params: z
        .object({
            occasion: z.string().optional(),
            productType: z.string().optional(),
            audience: z.string().optional(),
            geo: z.string().optional(),
        })
        .optional(),
    seedIds: z.array(z.string()).optional(),
});
