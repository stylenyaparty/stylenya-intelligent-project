import type { FastifyInstance } from "fastify";
import { AuthController } from "./auth.controller.js";
import { postReviewerEnd, postReviewerSignup } from "./auth-reviewer.js";
import { requireAuth } from "../middleware/auth.js";

export async function authRoutes(app: FastifyInstance) {
    app.post("/login", AuthController.login);
    app.post("/reviewer/signup", postReviewerSignup);
    app.post("/reviewer/end", { preHandler: requireAuth }, postReviewerEnd);
}
