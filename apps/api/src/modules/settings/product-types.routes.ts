import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../interfaces/http/middleware/auth.js";
import { isAppError } from "../../types/app-error.js";
import {
    createProductType,
    listProductTypes,
    updateProductType,
} from "./product-types.service.js";

const createSchema = z.object({
    label: z.string(),
    key: z.string().optional(),
    synonyms: z.array(z.string()).optional(),
    required: z.boolean().optional(),
});

const updateSchema = z.object({
    label: z.string().optional(),
    synonyms: z.array(z.string()).optional(),
    required: z.boolean().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

const listQuerySchema = z.object({
    status: z.enum(["active", "archived", "all"]).optional(),
});

export async function productTypesRoutes(app: FastifyInstance) {
    app.get(
        "/settings/product-types",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async (request, reply) => {
            const parsed = listQuerySchema.safeParse(request.query ?? {});
            if (!parsed.success) {
                return reply.code(400).send({ error: "Invalid product type query" });
            }
            const status = parsed.data.status ?? "all";
            const productTypes = await listProductTypes(status);
            return { ok: true, productTypes };
        }
    );

    app.post(
        "/settings/product-types",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async (request, reply) => {
            try {
                const body = createSchema.parse(request.body);
                const productType = await createProductType(body);
                return reply.code(201).send({ ok: true, productType });
            } catch (error) {
                if (isAppError(error)) {
                    return reply
                        .code(error.statusCode)
                        .send({ code: error.code, message: error.message });
                }
                return reply
                    .code(400)
                    .send({ code: "INVALID_PRODUCT_TYPE", message: "Invalid product type payload." });
            }
        }
    );

    app.patch(
        "/settings/product-types/:id",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async (request, reply) => {
            try {
                const body = updateSchema.parse(request.body ?? {});
                const params = request.params as { id: string };
                const productType = await updateProductType(params.id, body);
                return reply.send({ ok: true, productType });
            } catch (error) {
                if (isAppError(error)) {
                    return reply
                        .code(error.statusCode)
                        .send({ code: error.code, message: error.message });
                }
                return reply.code(400).send({
                    code: "INVALID_PRODUCT_TYPE_UPDATE",
                    message: "Invalid product type update payload.",
                });
            }
        }
    );
}
