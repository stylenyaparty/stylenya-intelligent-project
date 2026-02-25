import { prisma } from "../db/prisma.js";
export async function createResearchRun(input) {
    const run = await prisma.webResearchRun.create({
        data: {
            query: input.query,
            mode: input.mode ?? "quick",
            status: "QUEUED",
            locale: input.locale ?? null,
            geo: input.geo ?? null,
            language: input.language ?? null,
        },
    });
    return run;
}
export async function getResearchRun(id) {
    return prisma.webResearchRun.findUnique({
        where: { id },
        include: {
            clusters: true,
            rows: true,
        },
    });
}
//# sourceMappingURL=research.service.js.map