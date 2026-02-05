-- Update DecisionDraft schema for daily inbox
ALTER TABLE "DecisionDraft" DROP CONSTRAINT IF EXISTS "DecisionDraft_weeklyFocusId_fkey";
ALTER TABLE "DecisionDraft" DROP CONSTRAINT IF EXISTS "DecisionDraft_promotedDecisionId_fkey";

DROP TABLE IF EXISTS "DecisionDraft";

DROP TYPE IF EXISTS "DecisionDraftStatus";
CREATE TYPE "DecisionDraftStatus" AS ENUM ('NEW', 'DISMISSED', 'PROMOTED');

CREATE TABLE "DecisionDraft" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdDate" TIMESTAMP(3) NOT NULL,
    "status" "DecisionDraftStatus" NOT NULL DEFAULT 'NEW',
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "recommendedActions" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "signalIds" JSONB NOT NULL,
    "seedSet" JSONB,
    "model" TEXT,
    "usage" JSONB,
    "promotedDecisionId" TEXT,

    CONSTRAINT "DecisionDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DecisionDraft_createdDate_idx" ON "DecisionDraft"("createdDate");
CREATE INDEX "DecisionDraft_status_idx" ON "DecisionDraft"("status");
CREATE UNIQUE INDEX "DecisionDraft_promotedDecisionId_key" ON "DecisionDraft"("promotedDecisionId");

ALTER TABLE "DecisionDraft" ADD CONSTRAINT "DecisionDraft_promotedDecisionId_fkey" FOREIGN KEY ("promotedDecisionId") REFERENCES "Decision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
