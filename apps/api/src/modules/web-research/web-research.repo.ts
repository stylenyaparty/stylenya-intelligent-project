import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db/prisma";
import type { PipelineResult, WebResearchInput } from "./web-research.types";

export async function createWebResearchRun(input: WebResearchInput) {
    return prisma.webResearchRun.create({
        data: {
            status: "RUNNING",
            mode: input.mode,
            query: input.query,
            locale: input.locale,
            geo: input.geo,
            language: input.language,
            seedJson: {
                market: input.market,
                topic: input.topic,
            },
        },
    });
}

export async function completeWebResearchRun(runId: string, result: PipelineResult) {
    return prisma.$transaction(async (tx) => {
        await tx.researchEvidence.deleteMany({ where: { row: { runId } } });
        await tx.researchRow.deleteMany({ where: { runId } });
        await tx.researchCluster.deleteMany({ where: { runId } });

        for (const cluster of result.clusters) {
            await tx.researchCluster.create({
                data: {
                    runId,
                    key: cluster.key,
                    label: cluster.label,
                    summary: cluster.summary,
                    rank: cluster.rank,
                    rowCount: cluster.rowCount,
                    topScore: cluster.topScore,
                    bundleJson: cluster.bundleJson ?? undefined,
                },
            });
        }

        for (const row of result.rows) {
            const createdRow = await tx.researchRow.create({
                data: {
                    runId,
                    url: row.url,
                    title: row.title,
                    snippet: row.snippet,
                    publishedAt: row.publishedAt,
                    score: row.score,
                    clusterKey: row.clusterKey,
                    clusterRank: row.clusterRank,
                    rawJson: row.rawJson ?? undefined,
                },
            });

            for (const evidence of row.evidences) {
                await tx.researchEvidence.create({
                    data: {
                        rowId: createdRow.id,
                        url: evidence.url,
                        title: evidence.title,
                        snippet: evidence.snippet,
                        publishedAt: evidence.publishedAt,
                        source: evidence.source,
                        rawJson: evidence.rawJson ?? undefined,
                    },
                });
            }
        }

        return tx.webResearchRun.update({
            where: { id: runId },
            data: {
                status: "SUCCESS",
                timingsMs: result.timingsMs,
                resultJson: result.resultBundle,
                errorJson: Prisma.JsonNull,
            },
            include: {
                clusters: true,
                rows: {
                    include: {
                        evidences: true,
                    },
                },
            },
        });
    });
}

export async function failWebResearchRun(runId: string, error: { message: string; code: string }) {
    return prisma.webResearchRun.update({
        where: { id: runId },
        data: {
            status: "FAILED",
            errorJson: error,
        },
    });
}

export async function getWebResearchRunById(id: string) {
    return prisma.webResearchRun.findUnique({
        where: { id },
        include: {
            clusters: true,
            rows: {
                include: {
                    evidences: true,
                },
            },
        },
    });
}
