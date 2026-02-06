import { prisma } from "../../infrastructure/db/prisma.js";
import { AppError } from "../../types/app-error.js";

export type SeoContextSeed = {
    id: string;
    term: string;
    kind: "INCLUDE" | "EXCLUDE";
    status: "ACTIVE" | "ARCHIVED";
};

function normalizeTerm(raw: string) {
    const trimmed = raw.trim().replace(/\s+/g, " ");
    if (!trimmed) {
        return null;
    }
    return trimmed.toLowerCase();
}

export async function listSeoContextSeeds() {
    const seeds = await prisma.keywordSeed.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, term: true, kind: true, status: true },
    });

    return {
        includeSeeds: seeds.filter((seed) => seed.kind === "INCLUDE"),
        excludeSeeds: seeds.filter((seed) => seed.kind === "EXCLUDE"),
    };
}

export async function createSeoContextSeed(input: { term: string; kind: SeoContextSeed["kind"] }) {
    const normalized = normalizeTerm(input.term);
    if (!normalized) {
        throw new AppError(400, "INVALID_SEED", "Seed term is required.");
    }

    const existing = await prisma.keywordSeed.findUnique({
        where: { term: normalized },
        select: { id: true },
    });
    if (existing) {
        throw new AppError(409, "SEED_EXISTS", "Seed already exists.");
    }

    return prisma.keywordSeed.create({
        data: {
            term: normalized,
            kind: input.kind,
            source: "CUSTOM",
            status: "ACTIVE",
        },
    });
}

export async function updateSeoContextSeed(
    id: string,
    updates: { status?: SeoContextSeed["status"]; kind?: SeoContextSeed["kind"] }
) {
    if (!updates.status && !updates.kind) {
        throw new AppError(400, "NO_UPDATES", "No updates provided.");
    }

    return prisma.keywordSeed.update({
        where: { id },
        data: {
            ...(updates.status ? { status: updates.status } : {}),
            ...(updates.kind ? { kind: updates.kind } : {}),
        },
    });
}

export async function getActiveSeoContextSeeds() {
    const seeds = await prisma.keywordSeed.findMany({
        where: { status: "ACTIVE" },
        select: { term: true, kind: true },
    });

    return {
        includeSeeds: seeds.filter((seed) => seed.kind === "INCLUDE").map((seed) => seed.term),
        excludeSeeds: seeds.filter((seed) => seed.kind === "EXCLUDE").map((seed) => seed.term),
    };
}
