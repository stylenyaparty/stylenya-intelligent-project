-- CreateEnum
CREATE TYPE "KeywordPriority" AS ENUM ('LOW', 'MED', 'HIGH');

-- AlterTable
ALTER TABLE "KeywordJob" RENAME COLUMN "max" TO "maxResults";
ALTER TABLE "KeywordJob" ALTER COLUMN "maxResults" SET DEFAULT 10;
UPDATE "KeywordJob" SET "maxResults" = 10 WHERE "maxResults" IS NULL;
ALTER TABLE "KeywordJob" ALTER COLUMN "maxResults" SET NOT NULL;

ALTER TABLE "KeywordJob" ALTER COLUMN "language" TYPE TEXT USING "language"::text;
UPDATE "KeywordJob" SET "language" = lower("language");

ALTER TABLE "KeywordJob" ADD COLUMN "engine" TEXT NOT NULL DEFAULT 'google';
ALTER TABLE "KeywordJob" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'US';
ALTER TABLE "KeywordJob" ADD COLUMN "providerUsed" TEXT NOT NULL DEFAULT 'mock';
UPDATE "KeywordJob" SET "engine" = lower("marketplace");

-- DropEnum
DROP TYPE "KeywordLanguage";

-- CreateTable
CREATE TABLE "PromotedKeywordSignal" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "jobItemId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "interestScore" INTEGER,
    "competitionScore" INTEGER,
    "priority" "KeywordPriority" NOT NULL DEFAULT 'HIGH',
    "promotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotedKeywordSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromotedKeywordSignal_jobItemId_key" ON "PromotedKeywordSignal"("jobItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotedKeywordSignal_keyword_engine_language_country_key" ON "PromotedKeywordSignal"("keyword", "engine", "language", "country");

-- CreateIndex
CREATE INDEX "PromotedKeywordSignal_keyword_idx" ON "PromotedKeywordSignal"("keyword");

-- CreateIndex
CREATE INDEX "PromotedKeywordSignal_promotedAt_idx" ON "PromotedKeywordSignal"("promotedAt");

-- AddForeignKey
ALTER TABLE "PromotedKeywordSignal" ADD CONSTRAINT "PromotedKeywordSignal_jobItemId_fkey" FOREIGN KEY ("jobItemId") REFERENCES "KeywordJobItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
