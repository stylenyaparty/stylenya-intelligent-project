import type { SalesPeriod } from "@prisma/client";
import { prisma } from "../../infrastructure/db/prisma";
import { evaluateProduct } from "../../modules/recommendations/rule-engine";
import type { WeeklyFocusItem } from "../../modules/recommendations/types";

type SalesIndex = Record<string, Partial<Record<SalesPeriod, { unitsSold: number }>>>;

export class RecommendWeeklyFocusUseCase {
    async execute(input?: { limit?: number }): Promise<WeeklyFocusItem[]> {
        const { items } = await this.executeDetailed(input);
        return items;
    }

    async executeDetailed(input?: { limit?: number }): Promise<{
        asOf: string;
        limit: number;
        items: WeeklyFocusItem[];
    }> {
        const limit = Math.min(Math.max(input?.limit ?? 7, 1), 25);

        const settingsRow = await prisma.settings.upsert({
            where: { id: 1 },
            update: {},
            create: { id: 1 },
            select: {
                boostSalesThresholdD90: true,
                retireSalesThresholdD180: true,
                requestThemePriorityThreshold: true,
            },
        });

        const products = await prisma.product.findMany({
            where: { status: "ACTIVE" },
            select: {
                id: true,
                name: true,
                seasonality: true,
                shopifyProductId: true,
            },
        });

        const sales = await prisma.salesRecord.findMany({
            where: { salesPeriod: { in: ["D90", "D180"] } },
            orderBy: { asOfDate: "desc" },
            select: { productId: true, salesPeriod: true, unitsSold: true, asOfDate: true },
        });

        const salesIdx: SalesIndex = {};
        for (const s of sales) {
            salesIdx[s.productId] ??= {};
            if (salesIdx[s.productId]?.[s.salesPeriod]) continue; // ya tomamos el más reciente
            salesIdx[s.productId][s.salesPeriod] = { unitsSold: s.unitsSold };
        }

        const since = new Date();
        since.setDate(since.getDate() - 30);

        const reqs = await prisma.request.findMany({
            where: { createdAt: { gte: since } },
            select: { productId: true },
        });

        const requestsByProduct: Record<string, number> = {};
        for (const r of reqs) {
            if (!r.productId) continue;
            requestsByProduct[r.productId] = (requestsByProduct[r.productId] ?? 0) + 1;
        }

        const evaluated: WeeklyFocusItem[] = products.map((p) => {
            const d90Units = salesIdx[p.id]?.D90?.unitsSold ?? 0;
            const d180Units = salesIdx[p.id]?.D180?.unitsSold ?? 0;

            return evaluateProduct({
                productId: p.id,
                name: p.name,
                settings: settingsRow,
                signals: {
                    inShopify: Boolean(p.shopifyProductId),
                    d90Units,
                    d180Units,
                    requests30d: requestsByProduct[p.id] ?? 0,
                    seasonality: p.seasonality,
                },
            });
        });

        evaluated.sort((a, b) => b.priorityScore - a.priorityScore);

        return {
            asOf: new Date().toISOString().slice(0, 10),
            limit,
            items: evaluated.slice(0, limit),
        };
    }
}
