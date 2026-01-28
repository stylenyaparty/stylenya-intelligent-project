import { prisma } from "../db/prisma.js";

export class PrismaDecisionLogRepository {
    async findLatest(engineVersion = "v1") {
        return prisma.decisionLog.findFirst({
            where: { engineVersion },
            orderBy: { weekStart: "desc" },
        });
    }

    async findByWeekStart(weekStart: Date, engineVersion = "v1") {
        return prisma.decisionLog.findUnique({
            where: {
                weekStart_engineVersion: { weekStart, engineVersion },
            },
        });
    }

    async upsertWeekSnapshot(params: {
        weekStart: Date;
        engineVersion?: string;
        items: unknown; // WeeklyFocusItem[] serializable
    }) {
        const engineVersion = params.engineVersion ?? "v1";

        return prisma.decisionLog.upsert({
            where: {
                weekStart_engineVersion: { weekStart: params.weekStart, engineVersion },
            },
            update: {
                itemsJson: params.items as any,
            },
            create: {
                weekStart: params.weekStart,
                engineVersion,
                itemsJson: params.items as any,
            },
        });
    }
}
