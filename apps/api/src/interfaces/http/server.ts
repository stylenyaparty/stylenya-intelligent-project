import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./routes.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// ✅ AQUÍ se registran TODAS las rutas
await registerRoutes(app);

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

app.ready(() => {
    console.log(app.printRoutes());
});

await app.listen({ port, host });
