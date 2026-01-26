import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

export type AuthClaims = {
    sub: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
    iss?: string;
    aud?: string | string[];
};

// Extiende FastifyRequest para tener request.auth
declare module "fastify" {
    interface FastifyRequest {
        auth?: AuthClaims;
    }
}

function getBearerToken(req: FastifyRequest): string | null {
    const header = req.headers.authorization;
    if (!header) return null;
    const [type, token] = header.split(" ");
    if (type !== "Bearer" || !token) return null;
    return token;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const token = getBearerToken(request);
    if (!token) {
        return reply.code(401).send({ error: "Missing token" });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
        return reply.code(500).send({ error: "JWT_SECRET not configured" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET as jwt.Secret, {
            issuer: "stylenya-intelligent-api",
            audience: "stylenya-dashboard",
        }) as AuthClaims;

        request.auth = decoded;
    } catch {
        return reply.code(401).send({ error: "Invalid token" });
    }
}

export function requireRole(...allowed: string[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.auth) {
            return reply.code(401).send({ error: "Missing token" });
        }
        if (!allowed.includes(request.auth.role)) {
            return reply.code(403).send({ error: "Forbidden" });
        }
    };
}
