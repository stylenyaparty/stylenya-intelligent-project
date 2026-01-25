import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { PrismaUserRepository } from "../../infrastructure/repositories/prisma-user-repository";
import { GetBootstrapStatusUseCase } from "../../application/use-cases/get-bootstrap-status";

import {
    CreateInitialAdminUseCase,
    EmailAlreadyExistsError,
    SetupAlreadyCompletedError,
} from "../../application/use-cases/create-initial-admin";

export async function registerRoutes(app: FastifyInstance) {
    app.get("/health", async () => ({ ok: true, service: "stylenya-api" }));

    app.get("/", async () => ({
        ok: true,
        service: "stylenya-api",
        version: "0.1.0",
        docs: {
            health: "/health",
            bootstrapStatus: "/v1/bootstrap-status",
        },
    }));

    app.get("/v1/bootstrap-status", async () => {
        const userRepo = new PrismaUserRepository();
        const uc = new GetBootstrapStatusUseCase(userRepo);
        return uc.execute();
    });

    app.post("/v1/initial-admin", async (req, reply) => {
        const Body = z.object({
            email: z.string().email(),
            name: z.string().min(1).optional(),
        });

        const body = Body.parse(req.body);

        try {
            const userRepo = new PrismaUserRepository();
            const uc = new CreateInitialAdminUseCase(userRepo);
            const result = await uc.execute(body);
            return reply.code(201).send(result);
        } catch (err) {
            if (err instanceof SetupAlreadyCompletedError) {
                return reply.code(409).send({ ok: false, reason: "SETUP_ALREADY_COMPLETED" });
            }
            if (err instanceof EmailAlreadyExistsError) {
                return reply.code(409).send({ ok: false, reason: "EMAIL_ALREADY_EXISTS" });
            }
            throw err;
        }
    });
}
