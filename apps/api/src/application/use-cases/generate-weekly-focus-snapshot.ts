import type { WeeklyFocusItem } from "./recommend-weekly-focus";
import { RecommendWeeklyFocusUseCase } from "./recommend-weekly-focus";
import { PrismaDecisionLogRepository } from "../../infrastructure/repositories/prisma-decision-log-repository";

function startOfWeekMonday(d = new Date()) {
    const date = new Date(d);
    const day = date.getDay(); // 0 Sun ... 6 Sat
    const diff = (day === 0 ? -6 : 1) - day; // move to Monday
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
}

export class GenerateWeeklyFocusSnapshotUseCase {
    constructor(
        private recommend: RecommendWeeklyFocusUseCase,
        private logs: PrismaDecisionLogRepository
    ) { }

    async execute(opts?: { date?: Date; engineVersion?: string }) {
        const weekStart = startOfWeekMonday(opts?.date ?? new Date());
        const engineVersion = opts?.engineVersion ?? "v1";

        // If exists, return it (no recompute)
        const existing = await this.logs.findByWeekStart(weekStart, engineVersion);
        if (existing) return existing;

        // Compute fresh
        const items: WeeklyFocusItem[] = await this.recommend.execute();

        // Persist snapshot
        return this.logs.upsertWeekSnapshot({ weekStart, engineVersion, items });
    }
}
