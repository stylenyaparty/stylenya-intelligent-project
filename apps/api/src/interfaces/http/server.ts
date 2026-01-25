import Fastify from "fastify";
import { registerRoutes } from "./routes";

export async function buildApp() {
    const app = Fastify({ logger: true });

    // OJO: prefijo global para todas las rutas
    await app.register(registerRoutes, { prefix: "/v1" });

    return app;
}

// si tu archivo arranca el server aquí:
const app = await buildApp();
await app.listen({ port: 3001, host: "0.0.0.0" });