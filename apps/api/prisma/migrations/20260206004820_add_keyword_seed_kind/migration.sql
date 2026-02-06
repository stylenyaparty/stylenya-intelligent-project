-- CreateEnum
CREATE TYPE "KeywordSeedKind" AS ENUM ('INCLUDE', 'EXCLUDE');

-- AlterTable
ALTER TABLE "KeywordSeed" ADD COLUMN "kind" "KeywordSeedKind" NOT NULL DEFAULT 'INCLUDE';

-- CreateIndex
CREATE INDEX "KeywordSeed_kind_status_idx" ON "KeywordSeed"("kind", "status");
