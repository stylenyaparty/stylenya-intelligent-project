import type { Product, SalesRecord, Settings, Request } from "@prisma/client";
import { prisma } from "../db/prisma";

export class PrismaInsightsRepository {
    async getSettings(): Promise<Settings | null> {
        return prisma.settings.findUnique({ where: { id: 1 } });
    }

    async listProducts(): Promise<Product[]> {
        return prisma.product.findMany();
    }

    async getSalesAgg(productIds: string[]): Promise<SalesRecord[]> {
        if (productIds.length === 0) return [];
        return prisma.salesRecord.findMany({
            where: { productId: { in: productIds } },
        });
    }

    async getThemeRequestCounts(): Promise<Array<{ theme: string; count: number }>> {
        const rows = await prisma.request.groupBy({
            by: ["theme"],
            _count: { theme: true },
        });

        return rows
            .filter((r) => r.theme && r.theme.trim().length > 0)
            .map((r) => ({ theme: r.theme!, count: r._count.theme }));
    }
}