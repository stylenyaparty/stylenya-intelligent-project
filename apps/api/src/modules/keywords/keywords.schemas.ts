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
export const keywordLanguageSchema = z.preprocess(
    (value) => (typeof value === "string" ? value.toLowerCase() : value),
    z.enum(["en", "es"])
);

export const keywordEngineSchema = z.preprocess(
    (value) => (typeof value === "string" ? value.toLowerCase() : value),
    z.enum(["google", "etsy", "shopify"])
).optional();
export const keywordCountrySchema = z
    .string()
    .min(2)
    .max(2);

export const keywordJobCreateSchema = z.object({
    mode: keywordJobModeSchema,
    marketplace: keywordMarketplaceSchema,
    language: keywordLanguageSchema,
    engine: keywordEngineSchema,
    country: keywordCountrySchema,
    niche: z.string().min(1).optional(),
    topic: z.string().min(1).optional(),
    maxResults: z.number().int().min(1).max(50).optional(),
    providerUsed: z.enum(["trends"]).optional(),
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
