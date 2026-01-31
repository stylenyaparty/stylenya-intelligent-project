import { prisma } from "../../infrastructure/db/prisma.js";
import { buildDedupeKey } from "../decisions/decision-dedupe.js";

export type ActionSuggestion = {
    actionType: "PROMOTE" | "CREATE" | "OPTIMIZE" | "PAUSE";
    targetType: "KEYWORD" | "PRODUCT" | "THEME";
    targetId: string;
    title: string;
    rationale: string;
    priorityScore: number;
    sources: { keyword: string; signalId: string }[];
    dedupeKey: string;
};

type MatchingProduct = {
    id: string;
    name: string;
    productType: string;
    shopifyProductId: string | null;
};

function normalizeText(value: string) {
    return value.trim().toLowerCase();
}

function keywordMatchesProduct(keyword: string, product: MatchingProduct) {
    const normalized = normalizeText(keyword);
    const name = normalizeText(product.name);
    const type = normalizeText(product.productType);

    return name.includes(normalized) || type.includes(normalized);
}

function keywordInTitle(keyword: string, product: MatchingProduct) {
    return normalizeText(product.name).includes(normalizeText(keyword));
}

function calculatePriorityScore(signal: {
    interestScore: number | null;
    competitionScore: number | null;
    priority: "LOW" | "MED" | "HIGH";
    hasMatch: boolean;
}) {
    const interest = signal.interestScore ?? 50;
    const competition = signal.competitionScore ?? 50;
    const base = interest - competition * 0.5;
    const priorityBoost = signal.priority === "HIGH" ? 20 : 0;
    const matchBoost = signal.hasMatch ? 10 : 0;

    return Math.round(base + priorityBoost + matchBoost);
}

export async function buildWeeklyFocusSuggestions(limit = 7): Promise<{
    asOf: string;
    limit: number;
    items: ActionSuggestion[];
}> {
    const cappedLimit = Math.min(Math.max(limit, 1), 25);
    const asOf = new Date();

    const [signals, products] = await Promise.all([
        prisma.promotedKeywordSignal.findMany({
            orderBy: { promotedAt: "desc" },
        }),
        prisma.product.findMany({
            select: {
                id: true,
                name: true,
                productType: true,
                shopifyProductId: true,
            },
        }),
    ]);

    const suggestions: ActionSuggestion[] = [];

    for (const signal of signals) {
        const matches = products.filter((product) =>
            keywordMatchesProduct(signal.keyword, product)
        );

        if (matches.length === 0) {
            const priorityScore = calculatePriorityScore({
                interestScore: signal.interestScore,
                competitionScore: signal.competitionScore,
                priority: signal.priority,
                hasMatch: false,
            });

            const suggestion = {
                actionType: "CREATE",
                targetType: "KEYWORD",
                targetId: signal.keyword,
                title: `Create product opportunity for "${signal.keyword}"`,
                rationale: `No matching products found for promoted keyword "${signal.keyword}". Consider creating a new SKU or collection.`,
                priorityScore,
                sources: [{ keyword: signal.keyword, signalId: signal.id }],
            } satisfies Omit<ActionSuggestion, "dedupeKey">;
            suggestions.push({
                ...suggestion,
                dedupeKey: buildDedupeKey({
                    actionType: suggestion.actionType,
                    targetType: suggestion.targetType,
                    targetId: suggestion.targetId,
                    sources: suggestion.sources,
                    asOf,
                }),
            });
            continue;
        }

        const rankedMatches = [...matches].sort((a, b) => {
            const aInTitle = keywordInTitle(signal.keyword, a) ? 1 : 0;
            const bInTitle = keywordInTitle(signal.keyword, b) ? 1 : 0;
            return bInTitle - aInTitle;
        });

        const match = rankedMatches[0];
        const hasKeywordInTitle = keywordInTitle(signal.keyword, match);
        const needsOptimize = Boolean(match.shopifyProductId) && !hasKeywordInTitle;
        const actionType = needsOptimize ? "OPTIMIZE" : "PROMOTE";

        const priorityScore = calculatePriorityScore({
            interestScore: signal.interestScore,
            competitionScore: signal.competitionScore,
            priority: signal.priority,
            hasMatch: true,
        });

        const suggestion = {
            actionType,
            targetType: "PRODUCT",
            targetId: match.id,
            title: needsOptimize
                ? `Optimize "${match.name}" for "${signal.keyword}"`
                : `Promote "${match.name}" for "${signal.keyword}"`,
            rationale: needsOptimize
                ? `Keyword "${signal.keyword}" matches the catalog, but the Shopify listing is missing it in the title.`
                : `Keyword "${signal.keyword}" aligns with an existing product. Consider highlighting it as a featured focus.`,
            priorityScore,
            sources: [{ keyword: signal.keyword, signalId: signal.id }],
        } satisfies Omit<ActionSuggestion, "dedupeKey">;
        suggestions.push({
            ...suggestion,
            dedupeKey: buildDedupeKey({
                actionType: suggestion.actionType,
                targetType: suggestion.targetType,
                targetId: suggestion.targetId,
                sources: suggestion.sources,
                asOf,
            }),
        });
    }

    suggestions.sort((a, b) => b.priorityScore - a.priorityScore);

    return {
        asOf: asOf.toISOString(),
        limit: cappedLimit,
        items: suggestions.slice(0, cappedLimit),
    };
}
