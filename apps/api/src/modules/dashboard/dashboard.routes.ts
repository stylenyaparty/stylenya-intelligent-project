import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../interfaces/http/middleware/auth";
import { prisma } from "../../infrastructure/db/prisma.js";
import { buildWeeklyFocusSuggestions } from "../weekly-focus/weekly-focus.service.js";

export async function dashboardRoutes(app: FastifyInstance) {
    app.get("/dashboard/kpis", { preHandler: requireAuth }, async (request) => {
        const safeCount = async (
            label: string,
            fn: () => Promise<number>
        ): Promise<number> => {
            try {
                return await fn();
            } catch (error) {
                request.log.warn({ err: error, label }, "Dashboard KPI query failed");
                return 0;
            }
        };

        const activeProducts = await safeCount("products", async () => {
            try {
                return await prisma.product.count({ where: { status: "ACTIVE" } });
            } catch (error) {
                request.log.warn(
                    { err: error, label: "products-status" },
                    "Product status filter failed, falling back to total count"
                );
                return prisma.product.count();
            }
        });

        const pendingDecisions = await safeCount("decisions-planned", () =>
            prisma.decision.count({ where: { status: "PLANNED" } })
        );

        const recentDecisions = await safeCount("decisions-recent", () => {
            const since = new Date();
            since.setDate(since.getDate() - 7);
            return prisma.decision.count({
                where: { createdAt: { gte: since } },
            });
        });

        const weeklyFocusItems = await safeCount("weekly-focus", async () => {
            const snapshot = await buildWeeklyFocusSuggestions();
            return snapshot.items.length;
        });

        return {
            activeProducts,
            weeklyFocusItems,
            pendingDecisions,
            recentDecisions,
            productOfWeek: null,
        };
    });
}
