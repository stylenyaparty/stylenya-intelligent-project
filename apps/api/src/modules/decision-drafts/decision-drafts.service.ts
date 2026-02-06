import { prisma } from "../../infrastructure/db/prisma.js";
import { AppError } from "../../types/app-error.js";
import { getDecisionDateRange } from "../decisions/decision-date-range.js";
import { buildDedupeKey } from "../decisions/decision-dedupe.js";
import { generateDecisionDrafts } from "../llm/llm.service.js";
import { getTopSignalsForBatch, type LlmSignalDto } from "../signals/signals.service.js";
import { getActiveSeoContextSeeds } from "../settings/seo-context.service.js";
import { getActiveProductTypes } from "../settings/product-types.service.js";
import {
    buildProductTypeMatches,
    filterSignals,
    matchProductTypes,
    matchTerms,
    normalize,
} from "../signals/relevance/seedRelevance.js";

const MAX_SIGNALS = 30;
const TOP_SIGNALS_LIMIT = 50;

function resolveCreatedDate(date?: string) {
    const range = getDecisionDateRange(date ? { date } : { now: new Date() });
    if (!range) {
        throw new AppError(400, "INVALID_DATE", "Invalid date format.");
    }
    return range.start;
}

export async function createDecisionDrafts(input: { batchId?: string }) {
    let batchId = input.batchId;
    if (!batchId) {
        const latestBatch = await prisma.signalBatch.findFirst({
            orderBy: { createdAt: "desc" },
            select: { id: true },
        });
        if (!latestBatch) {
            throw new AppError(400, "BATCH_REQUIRED", "batchId is required.");
        }
        batchId = latestBatch.id;
    }

    const batch = await prisma.signalBatch.findUnique({
        where: { id: batchId },
        select: { id: true },
    });
    if (!batch) {
        throw new AppError(404, "BATCH_NOT_FOUND", "Batch not found.");
    }

    const topSignals = await getTopSignalsForBatch(batchId, TOP_SIGNALS_LIMIT);
    if (topSignals.length === 0) {
        throw new AppError(400, "SIGNALS_REQUIRED", "At least one signal is required.");
    }

    const [productTypes, { includeSeeds, excludeSeeds }] = await Promise.all([
        getActiveProductTypes(),
        getActiveSeoContextSeeds(),
    ]);
    const relevanceMode = "strict" as const;
    const productTypeMatches = buildProductTypeMatches(productTypes);
    const relevanceContext = {
        productTypes: productTypeMatches,
        occasionTerms: includeSeeds,
        excludeTerms: excludeSeeds,
    };

    const {
        filteredSignals,
        filteredOutCount,
        matchedProductTypeKeys,
        matchedOccasionTerms,
        matchedExcludeTerms,
    } = filterSignals(topSignals, relevanceContext, relevanceMode);

    const finalSignals = filteredSignals.slice(0, MAX_SIGNALS);
    if (finalSignals.length < MAX_SIGNALS) {
        const excludeNorm = excludeSeeds.map(normalize).filter(Boolean);
        const selectedKeywords = new Set(finalSignals.map((signal) => signal.keyword));

        for (const signal of topSignals) {
            if (finalSignals.length >= MAX_SIGNALS) break;
            if (selectedKeywords.has(signal.keyword)) continue;

            const keywordNorm = normalize(signal.keyword ?? "");
            if (matchTerms(keywordNorm, excludeNorm).length > 0) {
                continue;
            }

            const productMatches = matchProductTypes(keywordNorm, productTypeMatches);
            if (productMatches.length === 0) {
                continue;
            }

            productMatches.forEach((key) => matchedProductTypeKeys.add(key));
            finalSignals.push(signal);
            selectedKeywords.add(signal.keyword);
        }
    }

    if (finalSignals.length === 0) {
        throw new AppError(400, "SIGNALS_REQUIRED", "At least one signal is required.");
    }

    const keywordRows = await prisma.keywordSignal.findMany({
        where: {
            batchId,
            keyword: { in: finalSignals.map((signal) => signal.keyword) },
        },
        select: { id: true, keyword: true },
    });
    const keywordToId = new Map(keywordRows.map((row) => [row.keyword, row.id]));

    const output = await generateDecisionDrafts({
        signals: finalSignals,
        maxDrafts: 5,
    });

    const createdDate = resolveCreatedDate();

    const createInputs = output.drafts
        .map((draft) => {
            const keywords = Array.from(
                new Set(draft.keywords.filter((keyword) => keywordToId.has(keyword)))
            );
            const signalIds = keywords
                .map((keyword) => keywordToId.get(keyword))
                .filter((id): id is string => Boolean(id));

            if (keywords.length === 0 || signalIds.length === 0) {
                return null;
            }

            return {
                createdDate,
                title: draft.title,
                whyNow: draft.why_now,
                riskNotes: draft.risk_notes,
                nextSteps: draft.next_steps,
                keywords,
                confidence: null,
                status: "NEW" as const,
                signalIds,
                model: output.meta.model,
                payloadSnapshot: {
                    sourceBatchId: batchId,
                    relevanceMode,
                    productTypesActiveCount: productTypes.length,
                    productTypesMatched: Array.from(matchedProductTypeKeys),
                    occasionTermsUsed: Array.from(matchedOccasionTerms),
                    excludeTermsUsed: Array.from(matchedExcludeTerms),
                    filteredOutCount,
                    finalSignalCount: finalSignals.length,
                    signals: finalSignals as LlmSignalDto[],
                },
                sourceBatchId: batchId,
            };
        })
        .filter((draft): draft is NonNullable<typeof draft> => Boolean(draft));

    if (createInputs.length === 0) {
        throw new AppError(502, "LLM_BAD_OUTPUT", "LLM drafts lacked valid keywords.");
    }

    const created = await prisma.$transaction(
        createInputs.map((data) =>
            prisma.decisionDraft.create({
                data,
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
                rationale: draft.whyNow,
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
