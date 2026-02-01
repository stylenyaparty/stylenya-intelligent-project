import { z } from "zod";

export const productStatusSchema = z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]);
export const seasonalitySchema = z.enum([
    "NONE",
    "VALENTINES",
    "EASTER",
    "BACK_TO_SCHOOL",
    "HALLOWEEN",
    "CHRISTMAS",
    "CUSTOM",
]);

export const productSourceSchema = z.enum(["SHOPIFY", "ETSY"]);

export const productListQuerySchema = z.object({
    statusScope: z.enum(["active", "draft", "archived", "all"]).default("active"),
    search: z.string().trim().min(1).optional(),
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
