// apps/api/src/infrastructure/security/jwt-service.ts
import * as jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

export type JwtPayload = {
    sub: string;
    email: string;
    role: "ADMIN" | "USER";
};

export class JwtService {
    constructor(
        private readonly secret: string,
        private readonly expiresIn: SignOptions["expiresIn"] = "7d"
    ) { }

    sign(payload: JwtPayload): string {
        const options: SignOptions = { expiresIn: this.expiresIn };
        return jwt.sign(payload, this.secret, options);
    }

    verify(token: string): JwtPayload {
        return jwt.verify(token, this.secret) as JwtPayload;
    }
}
