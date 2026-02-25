import { prisma } from "../db/prisma.js";

export async function getResearchRun(id: string) {
    return prisma.webResearchRun.findUnique({
        where: { id },
        include: {
            clusters: true,
            rows: true,
        },
    });
}

export async function listResearchRuns(input: {
    page: number;
    pageSize: number;
    status?: "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED";
    query?: string;
}) {
    const where = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.query
            ? {
                  query: {
                      contains: input.query,
                      mode: "insensitive" as const,
                  },
              }
            : {}),
    };

    const [total, items] = await prisma.$transaction([
        prisma.webResearchRun.count({ where }),
        prisma.webResearchRun.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
            select: {
                id: true,
                status: true,
                query: true,
                mode: true,
                createdAt: true,
                timingsMs: true,
            },
        }),
    ]);

    return { total, items };
}
