import { prisma } from "../../infrastructure/db/prisma.js";
import { AppError } from "../../types/app-error.js";
import { buildDedupeKey } from "../decisions/decision-dedupe.js";
import { generateDecisionDrafts } from "../llm/llm.service.js";

type DraftContext = {
    weeklyFocus: {
        id: string;
        asOf: Date;
        limit: number;
        itemsJson: unknown;
    };
    promotedSignals: Array<{
        id: string;
        keyword: string;
        engine: string;
        language: string;
        country: string;
        interestScore: number | null;
        competitionScore: number | null;
        priority: string;
    }>;
    keywordJobItems: Array<{
        id: string;
        jobId: string;
        term: string;
        source: string;
        resultJson: unknown;
        createdAt: Date;
    }>;
    products: Array<{
        id: string;
        name: string;
        productType: string;
        status: string;
        shopifyProductId: string | null;
    }>;
    recentDecisions: Array<{
        id: string;
        title: string;
        status: string;
        createdAt: Date;
    }>;
};

export async function buildDraftContext(weeklyFocusId: string): Promise<DraftContext> {
    const weeklyFocus = await prisma.weeklyFocus.findUnique({
        where: { id: weeklyFocusId },
    });

    if (!weeklyFocus) {
        throw new AppError(404, "WEEKLY_FOCUS_NOT_FOUND", "Weekly focus not found.");
    }

    const [promotedSignals, keywordJobItems, products, recentDecisions] = await Promise.all([
        prisma.promotedKeywordSignal.findMany({
            orderBy: { promotedAt: "desc" },
            take: 50,
        }),
        prisma.keywordJobItem.findMany({
            where: {
                status: "DONE",
                source: { not: "CUSTOM" },
                job: { status: "DONE" },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        }),
        prisma.product.findMany({
            where: { status: "ACTIVE" },
            select: {
                id: true,
                name: true,
                productType: true,
                status: true,
                shopifyProductId: true,
            },
        }),
        prisma.decision.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                title: true,
                status: true,
                createdAt: true,
            },
        }),
    ]);

    if (promotedSignals.length === 0 && keywordJobItems.length === 0 && products.length === 0) {
        throw new AppError(
            409,
            "INSUFFICIENT_CONTEXT",
            "Not enough real data to generate drafts."
        );
    }

    return {
        weeklyFocus,
        promotedSignals,
        keywordJobItems,
        products,
        recentDecisions,
    };
}

export async function createDecisionDrafts(weeklyFocusId: string, maxDrafts: number) {
    const context = await buildDraftContext(weeklyFocusId);
    const output = await generateDecisionDrafts({
        weeklyFocus: { id: context.weeklyFocus.id, asOf: context.weeklyFocus.asOf.toISOString() },
        context: {
            weeklyFocus: context.weeklyFocus.itemsJson,
            promotedSignals: context.promotedSignals,
            keywordJobItems: context.keywordJobItems,
            products: context.products,
            recentDecisions: context.recentDecisions,
        },
        maxDrafts,
    });

    const created = await prisma.$transaction(
        output.drafts.map((draft) =>
            prisma.decisionDraft.create({
                data: {
                    weeklyFocusId,
                    title: draft.title,
                    rationale: draft.rationale,
                    actions: draft.actions,
                    confidence: draft.confidence,
                    sources: draft.sources,
                    status: "ACTIVE",
                },
            })
        )
    );

    return created;
}

export async function listDecisionDrafts(weeklyFocusId: string, status?: "active" | "all") {
    return prisma.decisionDraft.findMany({
        where:
            status === "active" || !status
                ? { weeklyFocusId, status: "ACTIVE" }
                : { weeklyFocusId },
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

    const dedupeKey = buildDedupeKey({
        actionType: "CREATE",
        sources: [draft.sources],
    });

    const existing = await prisma.decision.findUnique({ where: { dedupeKey } });
    const decision =
        existing ??
        (await prisma.decision.create({
            data: {
                actionType: "CREATE",
                title: draft.title,
                rationale: draft.rationale,
                sources: draft.sources,
                priorityScore: draft.confidence,
                dedupeKey,
            },
        }));

    const updated = await prisma.decisionDraft.update({
        where: { id },
        data: { status: "PROMOTED", promotedDecisionId: decision.id },
    });

    return { draft: updated, decision };
}
