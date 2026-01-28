import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth/auth.routes";

import { z } from "zod";
import { PrismaUserRepository } from "../../infrastructure/repositories/prisma-user-repository";
import { GetBootstrapStatusUseCase } from "../../application/use-cases/get-bootstrap-status";
import {
    CreateInitialAdminUseCase,
    EmailAlreadyExistsError,
    SetupAlreadyCompletedError,
} from "../../application/use-cases/create-initial-admin";

import { requireAuth, requireRole } from "./middleware/auth.js"; 

import { RecommendWeeklyFocusUseCase } from "../../application/use-cases/recommend-weekly-focus.js";
import { PrismaInsightsRepository } from "../../infrastructure/repositories/prisma-insights-repository.js";


export async function registerRoutes(app: FastifyInstance) {
    app.get("/v1/me", { preHandler: requireAuth }, async (request) => {
        return { ok: true, auth: request.auth };
    });

    app.get(
        "/v1/admin/ping",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async () => ({ ok: true, admin: true })
    );
    
    app.get("/health", async () => ({ ok: true, service: "stylenya-api" }));

    app.get("/", async () => ({
        ok: true,
        service: "stylenya-api",
        version: "0.1.0",
        docs: {
            health: "/health",
            bootstrapStatus: "/v1/bootstrap-status",
            initialAdmin: "/v1/initial-admin",
            login: "/v1/auth/login",
        },
    }));
    const userRepo = new PrismaUserRepository();
    const getBootstrapStatus = new GetBootstrapStatusUseCase(userRepo);
    const createInitialAdmin = new CreateInitialAdminUseCase(userRepo);

    app.get("/v1/bootstrap-status", async () => {
        const result = await getBootstrapStatus.execute();
        return result;
    });

    const insightsRepo = new PrismaInsightsRepository();
    const recommendWeeklyFocus = new RecommendWeeklyFocusUseCase(insightsRepo);

    app.get(
        "/v1/recommendations/weekly-focus",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async () => {
            const items = await recommendWeeklyFocus.execute();
            return { ok: true, items };
        }
    );

    app.post("/v1/initial-admin", async (request, reply) => {
        const BodySchema = z.object({
            email: z.string().email(),
            password: z.string().min(8),
            name: z.string().min(1).optional(),
        });

        const body = BodySchema.parse(request.body);

        try {
            const result = await createInitialAdmin.execute(body);
            return reply.code(201).send(result);
        } catch (err: any) {
            if (err instanceof SetupAlreadyCompletedError) {
                return reply.code(409).send({ error: err.message });
            }
            if (err instanceof EmailAlreadyExistsError) {
                return reply.code(409).send({ error: err.message });
            }
            // Zod errors / unknown
            return reply.code(400).send({ error: "Invalid request" });
        }
    });
    await app.register(authRoutes, { prefix: "/v1/auth" });
}