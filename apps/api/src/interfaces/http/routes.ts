import { FastifyInstance } from "fastify";
import { PrismaUserRepository } from "../../infrastructure/repositories/prisma-user-repository";
import { GetBootstrapStatusUseCase } from "../../application/use-cases/get-bootstrap-status";

export async function registerRoutes(app: FastifyInstance) {
    app.get("/health", async () => {
        return { ok: true, service: "stylenya-api" };
    });

    app.get("/v1/bootstrap-status", async () => {
        const userRepo = new PrismaUserRepository();
        const uc = new GetBootstrapStatusUseCase(userRepo);
        return uc.execute();
    });
}
