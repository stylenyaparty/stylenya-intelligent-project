import { prisma } from "../../infrastructure/db/prisma.js";
import { AppError } from "../../types/app-error.js";
import { getDecisionDateRange } from "../decisions/decision-date-range.js";
import { buildDedupeKey } from "../decisions/decision-dedupe.js";
import { generateDecisionDrafts } from "../llm/llm.service.js";

const MAX_SIGNALS = 20;

function summarizeSeasonality(
    monthlySearches?: Record<string, number> | null
): { bestMonth: string; worstMonth: string; trend: string } | null {
    if (!monthlySearches || Object.keys(monthlySearches).length === 0) return null;
    const entries = Object.entries(monthlySearches).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) return null;

    let best = entries[0];
    let worst = entries[0];
    for (const entry of entries) {
        if (entry[1] > best[1]) best = entry;
        if (entry[1] < worst[1]) worst = entry;
    }

    const first = entries[0][1];
    const last = entries[entries.length - 1][1];
    const delta = last - first;
    const trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

    return { bestMonth: best[0], worstMonth: worst[0], trend };
}

function resolveCreatedDate(date?: string) {
    const range = getDecisionDateRange(
        date ? { date } : { now: new Date() }
    );
    if (!range) {
        throw new AppError(400, "INVALID_DATE", "Invalid date format.");
    }
    return range.start;
}

async function fetchSignals(input: { batchId?: string; signalIds?: string[] }) {
    const byId =
        input.signalIds && input.signalIds.length > 0
            ? await prisma.keywordSignal.findMany({
                where: { id: { in: input.signalIds } },
                orderBy: { createdAt: "desc" },
                take: MAX_SIGNALS,
            })
            : [];

    if (input.batchId && byId.length < MAX_SIGNALS) {
        const remaining = MAX_SIGNALS - byId.length;
        const batchSignals = await prisma.keywordSignal.findMany({
            where: { batchId: input.batchId },
            orderBy: { createdAt: "desc" },
            take: remaining,
        });
        const existingIds = new Set(byId.map((signal) => signal.id));
        const filtered = batchSignals.filter((signal) => !existingIds.has(signal.id));
        return [...byId, ...filtered].slice(0, MAX_SIGNALS);
    }

    return byId.slice(0, MAX_SIGNALS);
}

export async function createDecisionDrafts(input: {
    batchId?: string;
    signalIds?: string[];
    seeds?: string[];
    context?: string;
}) {
    const signals = await fetchSignals({
        batchId: input.batchId,
        signalIds: input.signalIds,
    });

    if (signals.length === 0) {
        throw new AppError(400, "SIGNALS_REQUIRED", "At least one signal is required.");
    }

    const payloadSignals = signals.map((signal) => ({
        id: signal.id,
        keyword: signal.keyword,
        keywordNormalized: signal.keywordNormalized,
        source: signal.source,
        geo: signal.geo,
        language: signal.language,
        createdAt: signal.createdAt.toISOString(),
        avgMonthlySearches: signal.avgMonthlySearches,
        competitionLevel: signal.competitionLevel,
        competitionIndex: signal.competitionIndex,
        cpcLow: signal.cpcLow,
        cpcHigh: signal.cpcHigh,
        change3mPct: signal.change3mPct,
        changeYoYPct: signal.changeYoYPct,
        currency: signal.currency,
        seasonality: summarizeSeasonality(
            signal.monthlySearchesJson as Record<string, number> | null
        ),
    }));

    const output = await generateDecisionDrafts({
        signals: payloadSignals,
        seeds: input.seeds ?? [],
        context: input.context ?? "",
        maxDrafts: 3,
    });

    const signalIds = signals.map((signal) => signal.id);
    const createdDate = resolveCreatedDate();

    const created = await prisma.$transaction(
        output.drafts.map((draft) =>
            prisma.decisionDraft.create({
                data: {
                    createdDate,
                    title: draft.title,
                    rationale: draft.rationale,
                    recommendedActions: draft.recommendedActions,
                    confidence: draft.confidence,
                    status: "NEW",
                    signalIds,
                    seedSet: input.seeds ?? undefined,
                    model: output.meta.model,
                },
            })
        )
    );

    return created;
}

export async function listDecisionDrafts(options: {
    date?: string;
    status?: "NEW" | "DISMISSED" | "PROMOTED" | "ALL";
}) {
    const dateRange = getDecisionDateRange(
        options.date ? { date: options.date } : { now: new Date() }
    );
    if (!dateRange) {
        throw new AppError(400, "INVALID_DATE", "Invalid date format.");
    }

    return prisma.decisionDraft.findMany({
        where: {
            createdDate: {
                gte: dateRange.start,
                lt: dateRange.end,
            },
            ...(options.status && options.status !== "ALL"
                ? { status: options.status }
                : {}),
        },
        orderBy: { createdAt: "desc" },
    });
}

export async function dismissDecisionDraft(id: string) {
    const draft = await prisma.decisionDraft.findUnique({ where: { id } });
    if (!draft) {
        throw new AppError(404, "DRAFT_NOT_FOUND", "Decision draft not found.");
    }
    return prisma.decisionDraft.update({
        where: { id },
        data: { status: "DISMISSED" },
    });
}

export async function promoteDecisionDraft(id: string) {
    const draft = await prisma.decisionDraft.findUnique({ where: { id } });
    if (!draft) {
        throw new AppError(404, "DRAFT_NOT_FOUND", "Decision draft not found.");
    }

    const signalIds = Array.isArray(draft.signalIds) ? (draft.signalIds as string[]) : [];
    if (signalIds.length === 0) {
        throw new AppError(409, "TRACEABILITY_REQUIRED", "Draft must include signal IDs.");
    }
    if (draft.status === "PROMOTED" && draft.promotedDecisionId) {
        throw new AppError(409, "DRAFT_ALREADY_PROMOTED", "Draft already promoted.");
    }

    const sources = [{ signalIds, seedSet: draft.seedSet ?? [] }];
    const dedupeKey = buildDedupeKey({
        actionType: "CREATE",
        sources,
    });

    const existing = await prisma.decision.findUnique({ where: { dedupeKey } });
    const decision =
        existing ??
        (await prisma.decision.create({
            data: {
                actionType: "CREATE",
                title: draft.title,
                rationale: draft.rationale,
                sources,
                priorityScore:
                    typeof draft.confidence === "number"
                        ? Math.round(draft.confidence)
                        : undefined,
                dedupeKey,
            },
        }));

    const updated = await prisma.decisionDraft.update({
        where: { id },
        data: { status: "PROMOTED", promotedDecisionId: decision.id },
    });

    return { draft: updated, decision };
}
