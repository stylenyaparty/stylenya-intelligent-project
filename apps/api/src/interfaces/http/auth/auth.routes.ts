import type { FastifyInstance } from "fastify";
import { AuthController } from "./auth.controller.js";

export async function authRoutes(app: FastifyInstance) {
    app.post("/login", AuthController.login);
}
