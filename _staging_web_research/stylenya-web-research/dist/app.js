import Fastify from "fastify";
import { runResearch } from "./research/research.controller.js";
import { researchRoutes } from "./routes/research.routes.js";
export function buildApp() {
    const app = Fastify({ logger: true });
    app.get("/health", async () => {
        return { status: "ok" };
    });
    app.post("/research/run", runResearch);
    app.register(researchRoutes);
    return app;
}
//# sourceMappingURL=app.js.map