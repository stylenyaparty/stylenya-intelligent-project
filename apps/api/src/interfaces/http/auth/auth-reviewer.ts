import type { FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../../infrastructure/db/prisma.js";

const ReviewerSignupSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1).optional(),
    email: z.string().email(),
    password: z.string().min(8),
});

function reviewerAccessEnabled() {
    return process.env.ENABLE_REVIEWER_ACCESS === "true";
}

export async function postReviewerSignup(request: FastifyRequest, reply: FastifyReply) {
    if (!reviewerAccessEnabled()) {
        return reply.code(404).send({ error: "Not found" });
    }

    const parsed = ReviewerSignupSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const expectedCode = process.env.EVAL_ACCESS_CODE;
    if (!expectedCode || parsed.data.code !== expectedCode) {
        return reply.code(403).send({ error: "Invalid reviewer code" });
    }

    const email = parsed.data.email.toLowerCase();

    const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });

    if (existing) {
        return reply.code(409).send({ error: "Email already exists. Please login." });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    const user = await prisma.user.create({
        data: {
            email,
            name: parsed.data.name ?? null,
            passwordHash,
            role: "USER",
            isReviewer: true,
            archivedAt: null,
        },
        select: { id: true, email: true, name: true },
    });

    return reply.code(201).send({ user });
}

export async function postReviewerEnd(request: FastifyRequest, reply: FastifyReply) {
    if (!request.auth?.sub) {
        return reply.code(401).send({ error: "Unauthorized" });
    }

    if (!request.auth.isReviewer) {
        return reply.code(403).send({ error: "Forbidden" });
    }

    await prisma.user.update({
        where: { id: request.auth.sub },
        data: { archivedAt: new Date() },
    });

    return reply.code(204).send();
}
