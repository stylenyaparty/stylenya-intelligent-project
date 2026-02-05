import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { API_PREFIX } from "../interfaces/http/api-prefix.js";

const PUBLIC_ROUTES = new Set<string>([
    `GET ${API_PREFIX}/health`,
    `GET ${API_PREFIX}/bootstrap-status`,
    `POST ${API_PREFIX}/initial-admin`,
    `POST ${API_PREFIX}/auth/login`,
]);

const authGuardPlugin: FastifyPluginAsync = async (app) => {
    app.addHook("preHandler", async (req, reply) => {
        // url tipado (si existe), si no, fallback a req.url
        const path = ((req.routeOptions?.url as string | undefined) ?? req.url).split("?")[0];

        if (!path.startsWith(`${API_PREFIX}/`)) return;

        const allowKey = `${req.method} ${path}`;
        if (PUBLIC_ROUTES.has(allowKey)) return;

        try {
            await req.jwtVerify();
        } catch {
            return reply
                .code(401)
                .header("WWW-Authenticate", "Bearer")
                .send({ error: "Unauthorized" });
        }
    });
};

export default fp(authGuardPlugin);
