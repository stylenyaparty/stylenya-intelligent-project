import jwt from "jsonwebtoken";

const ISSUER = "stylenya-intelligent-api";
const AUDIENCE = "stylenya-dashboard";

export function signAccessToken(payload: { sub: string; email: string; role: string }) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not configured");

    const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];

    return jwt.sign(payload, secret as jwt.Secret, {
        expiresIn,
        issuer: ISSUER,
        audience: AUDIENCE,
    });
}
