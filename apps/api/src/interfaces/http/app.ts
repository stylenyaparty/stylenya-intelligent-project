import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { registerRoutes } from "./routes.js";
import authGuardPlugin from "../../plugins/auth-guard.js";

type CreateAppOptions = {
    logger?: boolean;
};

export async function createApp(options: CreateAppOptions = {}) {
    const app = Fastify({ logger: options.logger ?? true });

    await app.register(cors, { origin: true });
    await app.register(jwt, {
        secret: process.env.JWT_SECRET!,
    });
    await app.register(authGuardPlugin);
    await registerRoutes(app);

    return app;
}
