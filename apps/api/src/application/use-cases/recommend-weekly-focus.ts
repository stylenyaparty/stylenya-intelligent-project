import { randomUUID } from "crypto";
import type { PrismaInsightsRepository } from "../../infrastructure/repositories/prisma-insights-repository";

type DecisionType = "BOOST" | "KEEP" | "PAUSE" | "RETIRE" | "MIGRATE" | "LAUNCH" | "PROMOTE";
type TargetType = "PRODUCT" | "COLLECTION" | "THEME";
type Confidence = "LOW" | "MED" | "HIGH";

export type WeeklyFocusItem = {
    id: string;
    decisionType: DecisionType;
    targetType: TargetType;
    targetId: string;
    title: string;
    why: string[];
    confidence: Confidence;
    evidence: Record<string, any>;
    createdAt: string;
};

export class RecommendWeeklyFocusUseCase {
    constructor(private repo: PrismaInsightsRepository) { }

    async execute(): Promise<WeeklyFocusItem[]> {
        const settings =
            (await this.repo.getSettings()) ?? {
                boostSalesThresholdD90: 10,
                retireSalesThresholdD180: 2,
                requestThemePriorityThreshold: 3,
                defaultCurrency: "USD",
            };
        const products = await this.repo.listProducts();
        const productIds = products.map((p) => p.id);
        const sales = await this.repo.getSalesAgg(productIds);
        const themeCounts = await this.repo.getThemeRequestCounts();

        // Index sales by product+period (Prisma camelCase)
        const byProd: Record<
            string,
            Record<string, { unitsSold: number; revenueAmount: number }>
        > = {};

        for (const s of sales) {
            const pid = s.productId;
            const period = s.salesPeriod; // "D90", "D180", etc.

            byProd[pid] ||= {};
            byProd[pid][period] = {
                unitsSold: s.unitsSold ?? 0,
                revenueAmount: Number(s.revenueAmount ?? 0),
            };
        }

        const items: WeeklyFocusItem[] = [];

        // --- Product rules
        for (const p of products) {
            const d90 = byProd[p.id]?.D90 ?? { unitsSold: 0, revenueAmount: 0 };
            const d180 = byProd[p.id]?.D180 ?? { unitsSold: 0, revenueAmount: 0 };

            const inShopify = !!p.shopifyProductId;
            const inEtsy = !!p.etsyListingId;

            // MIGRATE: buen Etsy, no está en Shopify
            if (inEtsy && !inShopify && d90.unitsSold >= settings.boostSalesThresholdD90) {
                items.push({
                    id: randomUUID(),
                    decisionType: "MIGRATE",
                    targetType: "PRODUCT",
                    targetId: p.id,
                    title: `Migrate: ${p.name} → Shopify`,
                    why: [
                        `Strong Etsy performance in last 90d (${d90.unitsSold} units).`,
                        "Not yet available in Shopify (cold-start risk).",
                    ],
                    confidence: "HIGH",
                    evidence: { d90, inShopify, inEtsy, seasonality: p.seasonality, productSource: p.productSource },
                    createdAt: new Date().toISOString(),
                });
                continue;
            }

            // BOOST: buen performance
            if (d90.unitsSold >= settings.boostSalesThresholdD90) {
                items.push({
                    id: randomUUID(),
                    decisionType: "BOOST",
                    targetType: "PRODUCT",
                    targetId: p.id,
                    title: `Boost: ${p.name}`,
                    why: [
                        `Meets boost threshold in last 90d (${d90.unitsSold} units).`,
                        "Candidate for Product of the Week / promo copy.",
                    ],
                    confidence: inEtsy ? "HIGH" : "MED",
                    evidence: { d90, inShopify, inEtsy, seasonality: p.seasonality },
                    createdAt: new Date().toISOString(),
                });
            }

            // RETIRE candidate: muy bajo 180d y no estacional
            if ((d180.unitsSold ?? 0) <= settings.retireSalesThresholdD180 && p.seasonality === "NONE") {
                items.push({
                    id: randomUUID(),
                    decisionType: "RETIRE",
                    targetType: "PRODUCT",
                    targetId: p.id,
                    title: `Retire candidate: ${p.name}`,
                    why: [
                        `Low performance in last 180d (${d180.unitsSold} units).`,
                        "Not seasonal (no upcoming seasonal upside).",
                    ],
                    confidence: "MED",
                    evidence: { d180, seasonality: p.seasonality },
                    createdAt: new Date().toISOString(),
                });
            }
        }

        // --- Theme rule (LAUNCH)
        for (const t of themeCounts) {
            if (t.count >= settings.requestThemePriorityThreshold) {
                items.push({
                    id: randomUUID(),
                    decisionType: "LAUNCH",
                    targetType: "THEME",
                    targetId: t.theme,
                    title: `Launch theme: ${t.theme}`,
                    why: [
                        `High request volume (${t.count}).`,
                        "Opportunity to create new SKUs aligned to demand.",
                    ],
                    confidence: "MED",
                    evidence: { requestsCount: t.count },
                    createdAt: new Date().toISOString(),
                });
            }
        }

        // --- Prioritization (MVP simple)
        const weight: Record<string, number> = { MIGRATE: 100, BOOST: 80, LAUNCH: 60, KEEP: 40, PAUSE: 30, RETIRE: 10, PROMOTE: 70 };
        items.sort((a, b) => (weight[b.decisionType] ?? 0) - (weight[a.decisionType] ?? 0));

        // Return top N (3–7 ideal)
        return items.slice(0, 7);
    }
}
