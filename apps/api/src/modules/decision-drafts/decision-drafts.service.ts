import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db/prisma.js";
import { AppError } from "../../types/app-error.js";
import { getDecisionDateRange } from "../decisions/decision-date-range.js";
import { buildDedupeKey } from "../decisions/decision-dedupe.js";
import { expandDecisionDraft, generateDecisionDrafts } from "../llm/llm.service.js";
import {
    getSignalsForBatchKeywords,
    getTopSignalsForBatch,
    type LlmSignalDto,
} from "../signals/signals.service.js";
import { getActiveSeoContextSeeds } from "../settings/seo-context.service.js";
import { getActiveProductTypes } from "../settings/product-types.service.js";
import {
    buildProductTypeMatches,
    filterSignals,
    matchProductTypes,
    matchTerms,
    normalize,
} from "../signals/relevance/seedRelevance.js";
import { logDecisionLogEvent } from "../decision-log-events/decision-log-events.service.js";

const MAX_SIGNALS = 30;
const TOP_SIGNALS_LIMIT = 50;
const EXPANSION_SIGNAL_LIMIT = 20;
const EXPANSION_TOP_SIGNALS_LIMIT = 60;

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
        createInputs.map((data) => prisma.decisionDraft.create({ data }))
    );

    await prisma.decisionLogEvent.createMany({
        data: created.map((draft) => {
            const snapshot = draft.payloadSnapshot as
                | {
                      sourceBatchId?: string;
                      relevanceMode?: string;
                      filteredOutCount?: number;
                      finalSignalCount?: number;
                  }
                | undefined;
            return {
                eventType: "DRAFT_CREATED",
                refType: "DecisionDraft",
                refId: draft.id,
                metaJson: {
                    batchId: draft.sourceBatchId ?? snapshot?.sourceBatchId ?? null,
                    relevanceMode: snapshot?.relevanceMode ?? "strict",
                    filteredOutCount: snapshot?.filteredOutCount ?? null,
                    finalSignalCount: snapshot?.finalSignalCount ?? null,
                },
            };
        }),
    });

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
    const updated = await prisma.decisionDraft.update({
        where: { id },
        data: { status: "DISMISSED" },
    });

    await logDecisionLogEvent({
        eventType: "DRAFT_DISMISSED",
        refType: "DecisionDraft",
        refId: updated.id,
        meta: {
            batchId: updated.sourceBatchId ?? null,
        },
    });

    return updated;
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

    const latestExpansion = await prisma.decisionDraftExpansion.findFirst({
        where: { draftId: draft.id },
        orderBy: { createdAt: "desc" },
    });

    const sources = [{ signalIds, seedSet: draft.seedSet ?? [] }];
    const dedupeKey = buildDedupeKey({
        actionType: "CREATE",
        sources,
    });

    const existing = await prisma.decision.findUnique({ where: { dedupeKey } });
    const expansionSource = latestExpansion
        ? {
              latestExpansionId: latestExpansion.id,
              kind: latestExpansion.kind,
              createdAt: latestExpansion.createdAt.toISOString(),
              model: latestExpansion.model ?? null,
              provider: latestExpansion.provider ?? null,
          }
        : null;

    const nextSources: Prisma.JsonObject = {
        draft: { id: draft.id },
        signals: sources,
        ...(expansionSource ? { expansion: expansionSource } : {}),
    };

    const mergedSources = mergeDecisionSources(existing?.sources, nextSources);

    const decision =
        existing ??
        (await prisma.decision.create({
            data: {
                actionType: "CREATE",
                title: draft.title,
                rationale: draft.whyNow,
                sources: mergedSources,
                priorityScore:
                    typeof draft.confidence === "number"
                        ? Math.round(draft.confidence)
                        : undefined,
                dedupeKey,
            },
        }));

    if (existing) {
        await prisma.decision.update({
            where: { id: existing.id },
            data: { sources: mergedSources },
        });
    }

    const existingPromotion = await prisma.decisionDraft.findFirst({
        where: { promotedDecisionId: decision.id },
    });

    if (existingPromotion && existingPromotion.id !== draft.id) {
        const updated = await prisma.decisionDraft.update({
            where: { id },
            data: { status: "PROMOTED" },
        });

        await logDecisionLogEvent({
            eventType: "DRAFT_PROMOTED",
            refType: "DecisionDraft",
            refId: updated.id,
            meta: {
                batchId: updated.sourceBatchId ?? null,
                decisionId: decision.id,
            },
        });

        return {
            draft: updated,
            decision,
            message: "That decision was already added or promoted.",
        };
    }

    const updated = await prisma.decisionDraft.update({
        where: { id },
        data: { status: "PROMOTED", promotedDecisionId: decision.id },
    });

    await logDecisionLogEvent({
        eventType: "DRAFT_PROMOTED",
        refType: "DecisionDraft",
        refId: updated.id,
        meta: {
            batchId: updated.sourceBatchId ?? null,
            decisionId: decision.id,
        },
    });

    return { draft: updated, decision };
}

function mergeDecisionSources(
    existingSources: unknown,
    nextSources: Prisma.JsonObject
): Prisma.InputJsonValue {
    if (!existingSources) {
        return nextSources;
    }
    if (Array.isArray(existingSources)) {
        return { legacySources: existingSources, ...nextSources } as Prisma.JsonObject;
    }
    if (typeof existingSources === "object") {
        return { ...(existingSources as Prisma.JsonObject), ...nextSources };
    }
    return { legacySources: existingSources, ...nextSources } as Prisma.JsonObject;
}

function resolveDraftKeywords(draft: { keywords: unknown }) {
    if (Array.isArray(draft.keywords)) {
        return draft.keywords.filter((value): value is string => typeof value === "string");
    }
    return [];
}

function resolveDraftNextSteps(draft: { nextSteps: unknown }) {
    if (Array.isArray(draft.nextSteps)) {
        return draft.nextSteps.filter((value): value is string => typeof value === "string");
    }
    return [];
}

export async function expandDecisionDraftById(params: {
    id: string;
    focus?: string | null;
    kind?: "EXPAND" | "REFORMULATE" | "RERUN";
}) {
    const draft = await prisma.decisionDraft.findUnique({ where: { id: params.id } });
    if (!draft) {
        throw new AppError(404, "DRAFT_NOT_FOUND", "Decision draft not found.");
    }

    const draftKeywords = resolveDraftKeywords(draft);
    const draftNextSteps = resolveDraftNextSteps(draft);
    const batchId = draft.sourceBatchId ?? undefined;

    if (!batchId) {
        throw new AppError(400, "BATCH_REQUIRED", "Draft missing source batch.");
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

    const keywordSignals = await getSignalsForBatchKeywords(batchId, draftKeywords);
    const keywordSignalMatches =
        keywordSignals.length > 0
            ? filterSignals(keywordSignals, relevanceContext, relevanceMode)
            : null;

    let filteredSignals = keywordSignalMatches?.filteredSignals ?? [];
    let filteredOutCount = keywordSignalMatches?.filteredOutCount ?? 0;
    let matchedProductTypeKeys = keywordSignalMatches?.matchedProductTypeKeys ?? new Set<string>();
    let matchedOccasionTerms = keywordSignalMatches?.matchedOccasionTerms ?? new Set<string>();
    let matchedExcludeTerms = keywordSignalMatches?.matchedExcludeTerms ?? new Set<string>();

    if (filteredSignals.length === 0) {
        const fallbackSignals = await getTopSignalsForBatch(batchId, EXPANSION_TOP_SIGNALS_LIMIT);
        const fallbackMatches = filterSignals(fallbackSignals, relevanceContext, relevanceMode);
        filteredSignals = fallbackMatches.filteredSignals;
        filteredOutCount = fallbackMatches.filteredOutCount;
        matchedProductTypeKeys = fallbackMatches.matchedProductTypeKeys;
        matchedOccasionTerms = fallbackMatches.matchedOccasionTerms;
        matchedExcludeTerms = fallbackMatches.matchedExcludeTerms;

        const draftProductTypeKeys = new Set<string>();
        draftKeywords.forEach((keyword) => {
            const matches = matchProductTypes(normalize(keyword), productTypeMatches);
            matches.forEach((key) => draftProductTypeKeys.add(key));
        });

        if (draftProductTypeKeys.size > 0) {
            filteredSignals = filteredSignals.filter((signal) => {
                const matches = matchProductTypes(normalize(signal.keyword), productTypeMatches);
                return matches.some((key) => draftProductTypeKeys.has(key));
            });
        }
    }

    const finalSignals = filteredSignals.slice(0, EXPANSION_SIGNAL_LIMIT);
    if (finalSignals.length === 0) {
        throw new AppError(400, "SIGNALS_REQUIRED", "At least one signal is required.");
    }

    const productTypeKeys = Array.from(matchedProductTypeKeys);
    const derivedProductTypes = new Set(productTypeKeys);
    if (derivedProductTypes.size === 0) {
        draftKeywords.forEach((keyword) => {
            const matches = matchProductTypes(normalize(keyword), productTypeMatches);
            matches.forEach((key) => derivedProductTypes.add(key));
        });
    }
    const productTypeDtos = productTypes
        .filter((type) => derivedProductTypes.has(type.key))
        .map((type) => ({
            key: type.key,
            label: type.label,
            synonyms: Array.isArray(type.synonyms) ? type.synonyms : undefined,
        }));

    const productTypeFilter =
        productTypeDtos.length > 0
            ? { productType: { in: productTypeDtos.map((type) => type.key) } }
            : undefined;

    const products = await prisma.product.findMany({
        where: productTypeFilter
            ? productTypeFilter
            : draftKeywords.length > 0
              ? {
                    OR: draftKeywords.map((keyword) => ({
                        name: { contains: keyword, mode: "insensitive" },
                    })),
                }
              : undefined,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
            id: true,
            name: true,
            productType: true,
        },
    });

    const promptInput = {
        businessContext:
            "Stylenya sells personalized party decorations (stickers, cake toppers, drink stirrers). Sales are mainly via Etsy and Shopify.",
        draft: {
            title: draft.title,
            keywords: draftKeywords,
            why_now: draft.whyNow,
            risk_notes: draft.riskNotes,
            next_steps: draftNextSteps,
        },
        focus: params.focus ?? null,
        signals: finalSignals,
        productTypes: productTypeDtos,
        catalog: products.map((product) => ({
            id: product.id,
            title: product.name,
            productType: product.productType,
        })),
    };

    const start = Date.now();
    const llmResult = await expandDecisionDraft(promptInput);
    const latencyMs = Date.now() - start;

    const expansion = await prisma.decisionDraftExpansion.create({
        data: {
            draftId: draft.id,
            kind: params.kind ?? "EXPAND",
            focus: params.focus ?? null,
            promptSnapshot: llmResult.promptSnapshot as any,
            responseJson: llmResult.response as any,
            responseRaw: llmResult.responseRaw,
            model: llmResult.meta.model,
            provider: llmResult.meta.provider,
            tokensIn: llmResult.meta.tokensIn,
            tokensOut: llmResult.meta.tokensOut,
            latencyMs,
        },
    });

    const updatedDraft = await prisma.decisionDraft.update({
        where: { id: draft.id },
        data: {
            lastExpandedAt: new Date(),
            expansionsCount: { increment: 1 },
        },
    });

    const eventType =
        expansion.kind === "REFORMULATE"
            ? "DRAFT_REFORMULATED"
            : expansion.kind === "RERUN"
              ? "DRAFT_RERUN"
              : "DRAFT_EXPANDED";

    await logDecisionLogEvent({
        eventType,
        refType: "DecisionDraft",
        refId: draft.id,
        meta: {
            batchId,
            relevanceMode,
            filteredOutCount,
            finalSignalCount: finalSignals.length,
            expansionId: expansion.id,
            model: llmResult.meta.model ?? null,
            provider: llmResult.meta.provider,
            tokensIn: llmResult.meta.tokensIn ?? null,
            tokensOut: llmResult.meta.tokensOut ?? null,
            latencyMs,
            productTypesMatched: productTypeDtos.map((type) => type.key),
            occasionTermsUsed: Array.from(matchedOccasionTerms),
            excludeTermsUsed: Array.from(matchedExcludeTerms),
        },
    });

    return { expansion, draft: updatedDraft };
}

export async function listDecisionDraftExpansions(draftId: string) {
    return prisma.decisionDraftExpansion.findMany({
        where: { draftId },
        orderBy: { createdAt: "desc" },
    });
}
