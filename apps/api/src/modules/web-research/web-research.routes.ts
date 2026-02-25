import type { FastifyInstance } from "fastify";
import { webResearchBodySchema, webResearchRunParamsSchema } from "./web-research.schemas";
import { getWebResearchRun, runWebResearch, WebResearchServiceError } from "./web-research.service";

export async function webResearchRoutes(app: FastifyInstance) {
    app.post("/web", async (request, reply) => {
        const parsed = webResearchBodySchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Invalid research payload" });
        }

        try {
            const run = await runWebResearch(parsed.data);
            return reply.code(200).send({ ok: true, run });
        } catch (error) {
            if (error instanceof WebResearchServiceError) {
                return reply.code(error.statusCode).send({ error: error.message });
            }
            return reply.code(500).send({ error: "Internal error" });
        }
    });

    app.get("/runs/:id", async (request, reply) => {
        const parsed = webResearchRunParamsSchema.safeParse(request.params);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Invalid run id" });
        }

        const run = await getWebResearchRun(parsed.data.id);
        if (!run) {
            return reply.code(404).send({ error: "Run not found" });
        }

        return reply.send({ ok: true, run });
    });
}
