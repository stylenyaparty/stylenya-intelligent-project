import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

const PUBLIC_ROUTES = new Set<string>([
    "GET /v1/health",
    "GET /v1/bootstrap-status",
    "POST /v1/initial-admin",
    "POST /v1/auth/login",
]);

const authGuardPlugin: FastifyPluginAsync = async (app) => {
    app.addHook("preHandler", async (req, reply) => {
        // url tipado (si existe), si no, fallback a req.url
        const path = ((req.routeOptions?.url as string | undefined) ?? req.url).split("?")[0];

        if (!path.startsWith("/v1/")) return;

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
