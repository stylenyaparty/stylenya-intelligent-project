-- CreateEnum
CREATE TYPE "KeywordSeedSource" AS ENUM ('CUSTOM', 'AUTO');

-- CreateEnum
CREATE TYPE "KeywordSeedStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KeywordJobMode" AS ENUM ('CUSTOM', 'AUTO', 'HYBRID');

-- CreateEnum
CREATE TYPE "KeywordMarketplace" AS ENUM ('ETSY', 'SHOPIFY', 'GOOGLE');

-- CreateEnum
CREATE TYPE "KeywordLanguage" AS ENUM ('EN', 'ES');

-- CreateEnum
CREATE TYPE "KeywordJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "KeywordJobItemSource" AS ENUM ('CUSTOM', 'AUTO', 'HYBRID');

-- CreateEnum
CREATE TYPE "KeywordJobItemStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "KeywordSeed" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "source" "KeywordSeedSource" NOT NULL,
    "status" "KeywordSeedStatus" NOT NULL DEFAULT 'ACTIVE',
    "tagsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordSeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordJob" (
    "id" TEXT NOT NULL,
    "mode" "KeywordJobMode" NOT NULL,
    "marketplace" "KeywordMarketplace" NOT NULL,
    "language" "KeywordLanguage" NOT NULL,
    "niche" TEXT NOT NULL DEFAULT 'party decorations',
    "paramsJson" JSONB NOT NULL,
    "status" "KeywordJobStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordJobItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "source" "KeywordJobItemSource" NOT NULL,
    "status" "KeywordJobItemStatus" NOT NULL DEFAULT 'PENDING',
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KeywordSeed_term_key" ON "KeywordSeed"("term");

-- CreateIndex
CREATE INDEX "KeywordSeed_term_idx" ON "KeywordSeed"("term");

-- CreateIndex
CREATE INDEX "KeywordSeed_term_lower_idx" ON "KeywordSeed"(lower("term"));

-- CreateIndex
CREATE INDEX "KeywordJobItem_jobId_idx" ON "KeywordJobItem"("jobId");

-- CreateIndex
CREATE INDEX "KeywordJobItem_term_idx" ON "KeywordJobItem"("term");

-- CreateIndex
CREATE INDEX "KeywordJobItem_term_lower_idx" ON "KeywordJobItem"(lower("term"));

-- AddForeignKey
ALTER TABLE "KeywordJobItem" ADD CONSTRAINT "KeywordJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "KeywordJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
