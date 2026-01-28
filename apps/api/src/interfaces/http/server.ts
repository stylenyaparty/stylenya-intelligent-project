import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { registerRoutes } from "./routes.js";
import authGuardPlugin from "../../plugins/auth-guard.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// 1) JWT primero
await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
});

// 2) Luego el guard global
await app.register(authGuardPlugin);

// 3) Luego rutas
await registerRoutes(app);

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

app.ready(() => {
    console.log(app.printRoutes());
});

await app.listen({ port, host });
