-- CreateEnum
CREATE TYPE "DraftExpansionKind" AS ENUM ('EXPAND', 'REFORMULATE', 'RERUN');

-- CreateEnum
CREATE TYPE "DecisionLogEventType" AS ENUM ('DRAFT_CREATED', 'DRAFT_EXPANDED', 'DRAFT_REFORMULATED', 'DRAFT_RERUN', 'DRAFT_PROMOTED', 'DRAFT_DISMISSED');

-- AlterTable
ALTER TABLE "DecisionDraft" ADD COLUMN     "expansionsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastExpandedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DecisionDraftExpansion" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "kind" "DraftExpansionKind" NOT NULL DEFAULT 'EXPAND',
    "focus" TEXT,
    "promptSnapshot" JSONB NOT NULL,
    "responseJson" JSONB NOT NULL,
    "responseRaw" TEXT,
    "model" TEXT,
    "provider" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionDraftExpansion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionLogEvent" (
    "id" TEXT NOT NULL,
    "eventType" "DecisionLogEventType" NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLogEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DecisionDraftExpansion_draftId_createdAt_idx" ON "DecisionDraftExpansion"("draftId", "createdAt");

-- CreateIndex
CREATE INDEX "DecisionLogEvent_eventType_createdAt_idx" ON "DecisionLogEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "DecisionLogEvent_refType_refId_idx" ON "DecisionLogEvent"("refType", "refId");

-- AddForeignKey
ALTER TABLE "DecisionDraftExpansion" ADD CONSTRAINT "DecisionDraftExpansion_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "DecisionDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
