import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/infrastructure/db/prisma.js";
import {
    createTestServer,
    seedAdmin,
    createUser,
    getAuthToken,
} from "../helpers.js";
import type { FastifyInstance } from "fastify";

describe("API integration", () => {
    let app: FastifyInstance;
    let request: ReturnType<typeof supertest>;

    beforeAll(async () => {
        app = await createTestServer();
        request = supertest(app.server);
    });

    afterAll(async () => {
        await app.close();
    });

    it("responds to health check", async () => {
        const response = await request.get("/health").expect(200);

        expect(response.body).toMatchObject({ ok: true, service: "stylenya-api" });
    });

    it("returns bootstrap status when no users exist", async () => {
        const response = await request.get("/v1/bootstrap-status").expect(200);

        expect(response.body).toEqual({ usersCount: 0, shouldShowInitialSetup: true });
    });

    it("returns bootstrap status when users exist", async () => {
        await createUser({
            email: "user@example.com",
            password: "UserPass123!",
            role: "USER",
        });

        const response = await request.get("/v1/bootstrap-status").expect(200);

        expect(response.body.usersCount).toBe(1);
        expect(response.body.shouldShowInitialSetup).toBe(false);
    });

    it("creates the initial admin and hashes the password", async () => {
        const payload = {
            email: "first-admin@example.com",
            password: "SecurePass123!",
            name: "First Admin",
        };

        const response = await request.post("/v1/initial-admin").send(payload).expect(201);

        expect(response.body.created).toBe(true);
        expect(response.body.user).toMatchObject({
            email: payload.email,
            name: payload.name,
            role: "ADMIN",
        });
        expect(response.body.user).not.toHaveProperty("passwordHash");

        const user = await prisma.user.findUnique({
            where: { email: payload.email },
        });

        expect(user).not.toBeNull();
        expect(user?.passwordHash).not.toBe(payload.password);
        expect(await bcrypt.compare(payload.password, user!.passwordHash)).toBe(true);
    });

    it("prevents creating a second initial admin", async () => {
        const first = await request
            .post("/v1/initial-admin")
            .send({ email: "admin1@example.com", password: "AdminPass123!", name: "Admin 1" })
            .expect(201);

        const second = await request
            .post("/v1/initial-admin")
            .send({ email: "admin2@example.com", password: "AdminPass123!", name: "Another Admin" })
            .expect(409);

        expect(second.body).toEqual({ error: "Initial setup already completed" });
    });

    it("authenticates a user with valid credentials", async () => {
        const payload = {
            email: `user-${Date.now()}@example.com`,
            password: "TestPass123!",
        };

        // Seed deterministic user in DB (bcrypt hash)
        await createUser({
            email: payload.email,
            password: payload.password,
            role: "ADMIN", // o "USER", da igual para login
        });

        const response = await request
            .post("/v1/auth/login")
            .send(payload)
            .expect(200);

        expect(response.body.token).toEqual(expect.any(String));
    });

    it("rejects login with invalid credentials", async () => {
        const payload = await seedAdmin(app, {
            email: "wrong-pass@example.com",
            password: "CorrectPass123!",
        });

        const response = await request
            .post("/v1/auth/login")
            .send({ email: payload.email, password: "IncorrectPass123!" })
            .expect(401);

        expect(response.body).toEqual({ error: "Invalid credentials" });
    });

    it("rejects login for a nonexistent user", async () => {
        const response = await request
            .post("/v1/auth/login")
            .send({ email: "missing@example.com", password: "NoPass123!" })
            .expect(401);

        expect(response.body).toEqual({ error: "Invalid credentials" });
    });

    it("requires authentication for /v1/me", async () => {
        const response = await request.get("/v1/me").expect(401);

        expect(response.body).toEqual({ error: "Unauthorized" });
    });

    it("returns auth claims for /v1/me and omits password hash", async () => {
        const payload = await seedAdmin(app, {
            email: "me-admin@example.com",
            password: "MePass123!",
        });
        const token = await getAuthToken(app, payload.email, payload.password);

        const response = await request
            .get("/v1/me")
            .set("Authorization", `Bearer ${token}`)
            .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.auth).toMatchObject({
            email: payload.email,
            role: "ADMIN",
        });
        expect(response.body.auth).not.toHaveProperty("passwordHash");
    });

    it("requires authentication for admin ping", async () => {
        const response = await request.get("/v1/admin/ping").expect(401);

        expect(response.body).toEqual({ error: "Unauthorized" });
    });

    it("forbids non-admin users from admin ping", async () => {
        const user = await createUser({
            email: "member@example.com",
            password: "MemberPass123!",
            role: "USER",
        });

        const token = await getAuthToken(app, user.email, "MemberPass123!");

        const response = await request
            .get("/v1/admin/ping")
            .set("Authorization", `Bearer ${token}`)
            .expect(403);

        expect(response.body).toEqual({ error: "Forbidden" });
    });

    it("allows admin users to access admin ping", async () => {
        const payload = await seedAdmin(app, {
            email: "admin-ping@example.com",
            password: "AdminPing123!",
        });
        const token = await getAuthToken(app, payload.email, payload.password);

        const response = await request
            .get("/v1/admin/ping")
            .set("Authorization", `Bearer ${token}`)
            .expect(200);

        expect(response.body).toEqual({ ok: true, admin: true });
    });
});
