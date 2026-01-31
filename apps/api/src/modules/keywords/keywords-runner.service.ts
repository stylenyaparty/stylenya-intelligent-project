import { prisma } from "../../infrastructure/db/prisma.js";
import { MockKeywordResearchProvider } from "./providers/mockKeywordResearchProvider.js";
import { suggestKeywords } from "../llm/suggest-keywords.service.js";

const provider = new MockKeywordResearchProvider();

function normalizeKeyword(value: string) {
    return value.trim().toLowerCase();
}

export async function runKeywordJob(jobId: string) {
    const job = await prisma.keywordJob.findUnique({ where: { id: jobId } });
    if (!job) {
        return null;
    }

    if (job.status === "DONE") {
        const existingItems = await prisma.keywordJobItem.findMany({
            where: { jobId },
            orderBy: { createdAt: "asc" },
        });
        return { job, items: existingItems };
    }

    await prisma.keywordJob.update({
        where: { id: jobId },
        data: { status: "RUNNING" },
    });

    try {
        if (job.mode === "AI") {
            const topic = job.topic?.trim();
            if (!topic) {
                throw new Error("Topic is required for AI keyword jobs.");
            }

            const max = Math.min(job.maxResults ?? 10, 50);
            const keywords = await suggestKeywords(topic, max);

            const existingItems = await prisma.keywordJobItem.findMany({
                where: { jobId },
            });
            const seen = new Set(existingItems.map((item) => normalizeKeyword(item.term)));
            const newKeywords = keywords.filter((keyword) => {
                const normalized = normalizeKeyword(keyword);
                if (seen.has(normalized)) {
                    return false;
                }
                seen.add(normalized);
                return true;
            });

            if (newKeywords.length > 0) {
                await prisma.keywordJobItem.createMany({
                    data: newKeywords.map((keyword) => ({
                        jobId,
                        term: keyword.trim(),
                        source: "AI",
                        status: "DONE",
                    })),
                });
            }

            const updatedJob = await prisma.keywordJob.update({
                where: { id: jobId },
                data: { status: "DONE" },
            });

            const items = await prisma.keywordJobItem.findMany({
                where: { jobId },
                orderBy: { createdAt: "asc" },
            });

            return { job: updatedJob, items };
        }

        const items = await prisma.keywordJobItem.findMany({
            where: { jobId },
            orderBy: { createdAt: "asc" },
        });
        const results = [];

        for (const item of items) {
            const result = provider.research({
                term: item.term,
                marketplace: job.marketplace,
                language: job.language,
            });

            const updated = await prisma.keywordJobItem.update({
                where: { id: item.id },
                data: {
                    status: "DONE",
                    resultJson: result,
                },
            });

            results.push(updated);
        }

        const updatedJob = await prisma.keywordJob.update({
            where: { id: jobId },
            data: { status: "DONE" },
        });

        return { job: updatedJob, items: results };
    } catch (error) {
        await prisma.keywordJob.update({
            where: { id: jobId },
            data: { status: "FAILED" },
        });
        throw error;
    }
}
