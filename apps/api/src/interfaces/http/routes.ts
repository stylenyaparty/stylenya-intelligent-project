import type { FastifyInstance } from "fastify";
import { recommendationsRoutes } from "./recommendations/routes";
import { authRoutes } from "./auth/auth.routes";
import { decisionsRoutes } from "./decisions/routes";
import { keywordsRoutes } from "../../modules/keywords/keywords.routes";
import { llmRoutes } from "../../modules/llm/llm.routes";
import { weeklyFocusRoutes } from "../../modules/weekly-focus/weekly-focus.routes";
import { dashboardRoutes } from "../../modules/dashboard/dashboard.routes";
import { productsRoutes } from "../../modules/products/products.routes";

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
import { PrismaDecisionLogRepository } from "../../infrastructure/repositories/prisma-decision-log-repository";
import { GenerateWeeklyFocusSnapshotUseCase } from "../../application/use-cases/generate-weekly-focus-snapshot";


export async function registerRoutes(app: FastifyInstance) {

    app.register(recommendationsRoutes, { prefix: "/v1" });

    app.register(decisionsRoutes, { prefix: "/v1" });

    app.register(keywordsRoutes, { prefix: "/v1" });

    app.register(llmRoutes, { prefix: "/v1" });

    app.register(weeklyFocusRoutes, { prefix: "/v1" });

    app.register(dashboardRoutes, { prefix: "/v1" });

    app.register(productsRoutes, { prefix: "/v1" });
    
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

    const recommendWeeklyFocus = new RecommendWeeklyFocusUseCase();
    const decisionLogRepo = new PrismaDecisionLogRepository();
    const generateWeeklySnapshot = new GenerateWeeklyFocusSnapshotUseCase(
        recommendWeeklyFocus,
        decisionLogRepo
    );
    
    app.get(
        "/v1/decisions/weekly-focus/latest",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async () => {
            const row = await decisionLogRepo.findLatest("v1");
            return { ok: true, decisionLog: row };
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
            if (!result.created) {
                const message =
                    result.reason === "SETUP_ALREADY_COMPLETED"
                        ? "Initial setup already completed"
                        : "Email already exists";
                return reply.code(409).send({ error: message });
            }
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

    app.post(
        "/v1/decisions/weekly-focus/generate",
        { preHandler: [requireAuth, requireRole("ADMIN")] },
        async (request, reply) => {
            const row = await generateWeeklySnapshot.execute();
            return reply.code(201).send({ ok: true, decisionLog: row });
        }
    );

    await app.register(authRoutes, { prefix: "/v1/auth" });
}
