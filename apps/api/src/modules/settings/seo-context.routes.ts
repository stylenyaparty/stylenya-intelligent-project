import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../interfaces/http/middleware/auth.js";
import { isAppError } from "../../types/app-error.js";
import {
    createSeoContextSeed,
    listSeoContextSeeds,
    updateSeoContextSeed,
} from "./seo-context.service.js";

const seedCreateSchema = z.object({
    term: z.string(),
    kind: z.enum(["INCLUDE", "EXCLUDE"]),
});

const seedUpdateSchema = z.object({
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
    kind: z.enum(["INCLUDE", "EXCLUDE"]).optional(),
});

export async function seoContextRoutes(app: FastifyInstance) {
    app.get("/settings/seo-context", { preHandler: [requireAuth] }, async () => {
        const context = await listSeoContextSeeds();
        return context;
    });

    app.post("/settings/seo-context/seeds", { preHandler: [requireAuth] }, async (request, reply) => {
        try {
            const body = seedCreateSchema.parse(request.body);
            const seed = await createSeoContextSeed(body);
            return reply.code(201).send({ ok: true, seed });
        } catch (error) {
            if (isAppError(error)) {
                return reply
                    .code(error.statusCode)
                    .send({ code: error.code, message: error.message });
            }
            return reply.code(400).send({ code: "INVALID_SEED", message: "Invalid seed payload." });
        }
    });

    app.patch(
        "/settings/seo-context/seeds/:id",
        { preHandler: [requireAuth] },
        async (request, reply) => {
            try {
                const body = seedUpdateSchema.parse(request.body ?? {});
                const params = request.params as { id: string };
                const seed = await updateSeoContextSeed(params.id, body);
                return reply.send({ ok: true, seed });
            } catch (error) {
                if (isAppError(error)) {
                    return reply
                        .code(error.statusCode)
                        .send({ code: error.code, message: error.message });
                }
                return reply
                    .code(400)
                    .send({ code: "INVALID_SEED_UPDATE", message: "Invalid seed update payload." });
            }
        }
    );
}
