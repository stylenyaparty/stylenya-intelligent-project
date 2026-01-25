import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma"; // ajusta path
// Si ya tienes zod en el proyecto, úsalo. Si no, valida "a mano".
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

export async function postAuthLogin(req: Request, res: Response) {
    // 1) Validate input
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid request",
            details: parsed.error.flatten(),
        });
    }

    const { email, password } = parsed.data;

    // 2) Find user by email (normalize to avoid casing issues)
    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true, email: true, role: true, passwordHash: true },
    });

    // 3) Constant-time-ish response for invalid credentials
    // (We still do a bcrypt compare even when user is null by using a fake hash.)
    const fakeHash =
        "$2a$10$0vvh1q1uJYQfQz2cQe8p6eYkS3hP1xHq9mVqZgq1rXQw7o3mX8t8u"; // any valid bcrypt hash
    const hashToCompare = user?.passwordHash || fakeHash;

    const ok = await bcrypt.compare(password, hashToCompare);

    if (!user || !ok) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    // 4) Build JWT payload (standard)
    const payload = {
        sub: user.id,
        email: user.email,
        role: user.role, // "ADMIN" | "USER" etc
    };

    const { secret, expiresIn } = getJwtConfig();

    const token = jwt.sign(payload, secret, {
        expiresIn,
        issuer: "stylenya-intelligent-api",
        audience: "stylenya-dashboard",
    });

    // 5) Return
    return res.status(200).json({
        token,
        user: { id: user.id, email: user.email, role: user.role },
    });
}
