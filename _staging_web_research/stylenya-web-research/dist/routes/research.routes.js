import { createResearchRun, getResearchRun, } from "../services/research.service.js";
export async function researchRoutes(app) {
    app.post("/v1/research/web", async (request, reply) => {
        const body = request.body;
        if (!body?.query) {
            return reply.status(400).send({ error: "query is required" });
        }
        const run = await createResearchRun(body);
        return {
            runId: run.id,
            status: run.status,
        };
    });
    app.get("/v1/research/runs/:id", async (request, reply) => {
        const { id } = request.params;
        const run = await getResearchRun(id);
        if (!run) {
            return reply.status(404).send({ error: "Run not found" });
        }
        return run;
    });
}
//# sourceMappingURL=research.routes.js.map