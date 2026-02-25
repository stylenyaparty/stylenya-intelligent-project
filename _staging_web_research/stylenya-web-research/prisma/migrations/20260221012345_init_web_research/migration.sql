-- CreateEnum
CREATE TYPE "WebResearchStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ResearchMode" AS ENUM ('quick', 'deep');

-- CreateTable
CREATE TABLE "WebResearchRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "WebResearchStatus" NOT NULL DEFAULT 'QUEUED',
    "mode" "ResearchMode" NOT NULL DEFAULT 'quick',
    "query" TEXT NOT NULL,
    "locale" TEXT,
    "geo" TEXT,
    "language" TEXT,
    "seedJson" JSONB,
    "timingsMs" JSONB,
    "errorJson" JSONB,
    "resultJson" JSONB,

    CONSTRAINT "WebResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchRow" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT,
    "publishedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "clusterKey" TEXT,
    "clusterRank" INTEGER,
    "rawJson" JSONB,

    CONSTRAINT "ResearchRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchCluster" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "summary" TEXT,
    "rank" INTEGER,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "topScore" DOUBLE PRECISION,
    "bundleJson" JSONB,

    CONSTRAINT "ResearchCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchEvidence" (
    "id" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "snippet" TEXT,
    "publishedAt" TIMESTAMP(3),
    "source" TEXT,
    "rawJson" JSONB,

    CONSTRAINT "ResearchEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebResearchRun_createdAt_idx" ON "WebResearchRun"("createdAt");

-- CreateIndex
CREATE INDEX "WebResearchRun_status_idx" ON "WebResearchRun"("status");

-- CreateIndex
CREATE INDEX "WebResearchRun_mode_idx" ON "WebResearchRun"("mode");

-- CreateIndex
CREATE INDEX "ResearchRow_runId_idx" ON "ResearchRow"("runId");

-- CreateIndex
CREATE INDEX "ResearchRow_publishedAt_idx" ON "ResearchRow"("publishedAt");

-- CreateIndex
CREATE INDEX "ResearchRow_score_idx" ON "ResearchRow"("score");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchRow_runId_url_key" ON "ResearchRow"("runId", "url");

-- CreateIndex
CREATE INDEX "ResearchCluster_runId_idx" ON "ResearchCluster"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchCluster_runId_key_key" ON "ResearchCluster"("runId", "key");

-- CreateIndex
CREATE INDEX "ResearchEvidence_rowId_idx" ON "ResearchEvidence"("rowId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchEvidence_rowId_url_key" ON "ResearchEvidence"("rowId", "url");

-- AddForeignKey
ALTER TABLE "ResearchRow" ADD CONSTRAINT "ResearchRow_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WebResearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchCluster" ADD CONSTRAINT "ResearchCluster_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WebResearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEvidence" ADD CONSTRAINT "ResearchEvidence_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "ResearchRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
