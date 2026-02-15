import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { createTestServer, apiPath } from "../helpers.js";

describe("reviewer access", () => {
    let app: FastifyInstance;
    let request: ReturnType<typeof supertest>;

    beforeAll(async () => {
        app = await createTestServer();
        request = supertest(app.server);
    });

    afterAll(async () => {
        await app.close();
    });

    it("allows reviewer signup when access is enabled", async () => {
        process.env.ENABLE_REVIEWER_ACCESS = "true";
        process.env.EVAL_ACCESS_CODE = "review-123";

        const response = await request.post(apiPath("/auth/reviewer/signup")).send({
            code: "review-123",
            name: "Reviewer",
            email: "reviewer@example.com",
            password: "ReviewPass123!",
        }).expect(201);

        expect(response.body.user).toMatchObject({
            email: "reviewer@example.com",
            name: "Reviewer",
        });
    });

    it("rejects signup with wrong reviewer code", async () => {
        process.env.ENABLE_REVIEWER_ACCESS = "true";
        process.env.EVAL_ACCESS_CODE = "review-123";

        const response = await request.post(apiPath("/auth/reviewer/signup")).send({
            code: "bad-code",
            name: "Reviewer",
            email: "reviewer2@example.com",
            password: "ReviewPass123!",
        }).expect(403);

        expect(response.body).toEqual({ error: "Invalid reviewer code" });
    });

    it("returns not found when reviewer access is disabled", async () => {
        process.env.ENABLE_REVIEWER_ACCESS = "false";
        process.env.EVAL_ACCESS_CODE = "review-123";

        const response = await request.post(apiPath("/auth/reviewer/signup")).send({
            code: "review-123",
            name: "Reviewer",
            email: "reviewer3@example.com",
            password: "ReviewPass123!",
        }).expect(404);

        expect(response.body).toEqual({ error: "Not found" });
    });

    it("returns conflict when reviewer signup email already exists", async () => {
        process.env.ENABLE_REVIEWER_ACCESS = "true";
        process.env.EVAL_ACCESS_CODE = "review-123";

        await request.post(apiPath("/auth/reviewer/signup")).send({
            code: "review-123",
            name: "Reviewer",
            email: "existing-reviewer@example.com",
            password: "ReviewPass123!",
        }).expect(201);

        const response = await request.post(apiPath("/auth/reviewer/signup")).send({
            code: "review-123",
            name: "Reviewer",
            email: "existing-reviewer@example.com",
            password: "ReviewPass123!",
        }).expect(409);

        expect(response.body).toEqual({ error: "Email already exists. Please login." });
    });

    it("ends review and blocks further access/login", async () => {
        process.env.ENABLE_REVIEWER_ACCESS = "true";
        process.env.EVAL_ACCESS_CODE = "review-123";

        const email = "flow-reviewer@example.com";
        const password = "ReviewPass123!";

        await request.post(apiPath("/auth/reviewer/signup")).send({
            code: "review-123",
            name: "Flow Reviewer",
            email,
            password,
        }).expect(201);

        const loginResponse = await request.post(apiPath("/auth/login")).send({
            email,
            password,
        }).expect(200);

        const token = loginResponse.body.token as string;

        await request.post(apiPath("/auth/reviewer/end"))
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

        const meResponse = await request.get(apiPath("/me"))
            .set("Authorization", `Bearer ${token}`)
            .expect(403);

        expect(meResponse.body).toEqual({ error: "Account disabled" });

        const reloginResponse = await request.post(apiPath("/auth/login")).send({
            email,
            password,
        }).expect(403);

        expect(reloginResponse.body).toEqual({ error: "Account disabled" });
    });
});
