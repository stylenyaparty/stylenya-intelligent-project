import type { FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../../infrastructure/db/prisma.js"; 

type LoginBody = {
    email: string;
    password: string;
};

function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

export const AuthController = {
    async login(request: FastifyRequest, reply: FastifyReply) {
        const body = request.body as Partial<LoginBody> | undefined;

        const email = typeof body?.email === "string" ? body.email : "";
        const password = typeof body?.password === "string" ? body.password : "";

        if (!email || !password) {
            return reply.code(400).send({ error: "Invalid request" });
        }

        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            return reply.code(500).send({ error: "JWT_SECRET not configured" });
        }

        const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];

        const user = await prisma.user.findUnique({
            where: { email: normalizeEmail(email) },
            select: { id: true, email: true, role: true, passwordHash: true },
        });

        // Anti user-enumeration
        const fakeHash =
            "$2a$10$0vvh1q1uJYQfQz2cQe8p6eYkS3hP1xHq9mVqZgq1rXQw7o3mX8t8u";

        const ok = await bcrypt.compare(password, user?.passwordHash ?? fakeHash);

        if (!user || !ok) {
            return reply.code(401).send({ error: "Invalid credentials" });
        }

        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };

        const secret: jwt.Secret = JWT_SECRET;

        const token = jwt.sign(payload, secret, {
            expiresIn: JWT_EXPIRES_IN,
            issuer: "stylenya-intelligent-api",
            audience: "stylenya-dashboard",
        });

        return reply.code(200).send({
            token,
            user: { id: user.id, email: user.email, role: user.role },
        });
    },
};
