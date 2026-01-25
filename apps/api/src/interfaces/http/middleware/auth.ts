import type { Request, Response, NextFunction } from "express";
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

declare global {
    namespace Express {
        interface Request {
            auth?: AuthClaims;
        }
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing token" });
    }

    const token = header.slice("Bearer ".length);
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not set");

    try {
        const decoded = jwt.verify(token, secret, {
            issuer: "stylenya-intelligent-api",
            audience: "stylenya-dashboard",
        }) as AuthClaims;

        req.auth = decoded;
        return next();
    } catch {
        return res.status(401).json({ error: "Invalid token" });
    }
}

export function requireRole(...allowed: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.auth) return res.status(401).json({ error: "Missing token" });
        if (!allowed.includes(req.auth.role)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        return next();
    };
}
