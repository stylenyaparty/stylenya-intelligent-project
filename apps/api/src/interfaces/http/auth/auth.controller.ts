import type { FastifyReply, FastifyRequest } from "fastify";
import { PrismaUserRepository } from "../../../infrastructure/repositories/prisma-user-repository.js";
import {
    LoginUserUseCase,
    InvalidCredentialsError,
    AccountDisabledError,
} from "../../../application/use-cases/login-user.js";

type LoginBody = { email: string; password: string };

export const AuthController = {
    async login(request: FastifyRequest, reply: FastifyReply) {
        const body = request.body as Partial<LoginBody> | undefined;

        const email = typeof body?.email === "string" ? body.email : "";
        const password = typeof body?.password === "string" ? body.password : "";

        if (!email || !password) {
            return reply.code(400).send({ error: "Invalid request" });
        }

        try {
            const useCase = new LoginUserUseCase(new PrismaUserRepository());
            const result = await useCase.execute({ email, password });
            return reply.code(200).send(result);
        } catch (err) {
            if (err instanceof AccountDisabledError) {
                return reply.code(403).send({ error: "Account disabled" });
            }
            if (err instanceof InvalidCredentialsError) {
                return reply.code(401).send({ error: "Invalid credentials" });
            }
            request.log.error({ err }, "login failed");
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    },
};
