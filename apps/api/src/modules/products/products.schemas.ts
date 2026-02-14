import { z } from "zod";

export const productStatusSchema = z.enum(["ACTIVE", "DRAFT", "ARCHIVED", "REVIEW"]);
export const seasonalitySchema = z.enum([
    "NONE",
    "VALENTINES",
    "EASTER",
    "BACK_TO_SCHOOL",
    "HALLOWEEN",
    "CHRISTMAS",
    "CUSTOM",
]);

export const productSourceSchema = z.enum(["SHOPIFY", "ETSY", "MANUAL"]);

export const productListQuerySchema = z.object({
    statusScope: z.enum(["active", "draft", "archived", "all"]).optional(),
    search: z.string().trim().min(1).optional(),
    source: z.enum(["SHOPIFY", "ETSY", "MANUAL"]).optional(),
    status: productStatusSchema.optional(),
    q: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const productCreateSchema = z.object({
    name: z.string().trim().min(1),
    productSource: productSourceSchema,
    productType: z.string().trim().min(1).default("unknown"),
    status: productStatusSchema.default("DRAFT"),
    seasonality: seasonalitySchema.default("NONE"),
});

export const productUpdateSchema = z
    .object({
        name: z.string().trim().min(1).optional(),
        productType: z.string().trim().min(1).optional(),
        status: productStatusSchema.optional(),
        seasonality: seasonalitySchema.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided",
    });

export const deleteConfirmSchema = z.object({
    confirm: z.literal(true),
});
