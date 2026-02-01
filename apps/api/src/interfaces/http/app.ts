import Fastify, { type FastifyLoggerOptions } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { registerRoutes } from "./routes.js";
import authGuardPlugin from "../../plugins/auth-guard.js";

type CreateAppOptions = {
    logger?: boolean | FastifyLoggerOptions;
};

export async function createApp(options: CreateAppOptions = {}) {
    const app = Fastify({
        logger: options.logger ?? { level: "info" },
    });

    await app.register(cors, { origin: true });
    await app.register(jwt, {
        secret: process.env.JWT_SECRET!,
    });
    await app.register(authGuardPlugin);
    await registerRoutes(app);

    app.setErrorHandler((err, request, reply) => {
        request.log.error({ err }, "Unhandled error");
        reply.status(500).send({
            error: "INTERNAL_SERVER_ERROR",
            message: err.message,
        });
    });

    return app;
}
