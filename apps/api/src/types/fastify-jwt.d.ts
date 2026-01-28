import "@fastify/jwt";

declare module "fastify" {
    interface FastifyRequest {
        jwtVerify(): Promise<void>;
        user?: {
            sub: string;
            email: string;
            role: "ADMIN" | "USER";
            [key: string]: any;
        };
    }
}
