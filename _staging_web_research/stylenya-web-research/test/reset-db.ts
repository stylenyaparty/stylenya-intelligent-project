import { prisma } from "../src/db/prisma.js";

export async function resetDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ResearchEvidence",
      "ResearchRow",
      "ResearchCluster",
      "WebResearchRun"
    RESTART IDENTITY CASCADE;
  `);
}
