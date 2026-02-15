import bcrypt from "bcryptjs";
import type { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { prisma } from "../../../infrastructure/db/prisma.js";
import { z } from "zod";

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

function getJwtConfig() {
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    if (!secret) throw new Error("JWT_SECRET is not set");
    return { secret, expiresIn };
}

export async function postAuthLogin(req: FastifyRequest, reply: FastifyReply) {
    // 1) Validate input
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
        return reply.status(400).send({
            error: "Invalid request",
            details: parsed.error.flatten(),
        });
    }

    const { email, password } = parsed.data;

    // 2) Find user by email (normalize to avoid casing issues)
    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true, email: true, role: true, passwordHash: true, archivedAt: true },
    });

    // 3) Constant-time-ish response for invalid credentials
    // (We still do a bcrypt compare even when user is null by using a fake hash.)
    const fakeHash =
        "$2a$10$0vvh1q1uJYQfQz2cQe8p6eYkS3hP1xHq9mVqZgq1rXQw7o3mX8t8u"; // any valid bcrypt hash
    const hashToCompare = user?.passwordHash || fakeHash;

    const ok = await bcrypt.compare(password, hashToCompare);

    if (!user || !ok) {
        return reply.status(401).send({ error: "Invalid credentials" });
    }

    if (user.archivedAt) {
        return reply.status(403).send({ error: "Account disabled" });
    }

    // 4) Build JWT payload (standard)
    const payload = {
        sub: user.id,
        email: user.email,
        role: user.role, // "ADMIN" | "USER" etc
    };

    const { secret, expiresIn } = getJwtConfig();

    const token = jwt.sign(payload, secret as string, {
        expiresIn,
        issuer: "stylenya-intelligent-api",
        audience: "stylenya-dashboard",
    } as jwt.SignOptions);

    // 5) Return
    return reply.status(200).send({
        token,
        user: { id: user.id, email: user.email, role: user.role },
    });
}
