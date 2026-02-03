-- Remove AI keyword job mode usage
DELETE FROM "KeywordJobItem" WHERE "source" = 'AI';
DELETE FROM "KeywordJob" WHERE "mode" = 'AI';

-- Drop topic column from keyword jobs
ALTER TABLE "KeywordJob" DROP COLUMN "topic";

-- Update KeywordJobMode enum to remove AI
CREATE TYPE "KeywordJobMode_new" AS ENUM ('CUSTOM', 'AUTO', 'HYBRID');
ALTER TABLE "KeywordJob" ALTER COLUMN "mode" TYPE "KeywordJobMode_new" USING ("mode"::text::"KeywordJobMode_new");
DROP TYPE "KeywordJobMode";
ALTER TYPE "KeywordJobMode_new" RENAME TO "KeywordJobMode";

-- Update KeywordJobItemSource enum to remove AI
CREATE TYPE "KeywordJobItemSource_new" AS ENUM ('CUSTOM', 'AUTO', 'HYBRID');
ALTER TABLE "KeywordJobItem" ALTER COLUMN "source" TYPE "KeywordJobItemSource_new" USING ("source"::text::"KeywordJobItemSource_new");
DROP TYPE "KeywordJobItemSource";
ALTER TYPE "KeywordJobItemSource_new" RENAME TO "KeywordJobItemSource";

-- Decision drafts + weekly focus tables
CREATE TYPE "DecisionDraftStatus" AS ENUM ('ACTIVE', 'DISMISSED', 'PROMOTED');

CREATE TABLE "WeeklyFocus" (
    "id" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "limit" INTEGER NOT NULL,
    "itemsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyFocus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DecisionDraft" (
    "id" TEXT NOT NULL,
    "weeklyFocusId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "confidence" INTEGER NOT NULL,
    "status" "DecisionDraftStatus" NOT NULL DEFAULT 'ACTIVE',
    "sources" JSONB NOT NULL,
    "promotedDecisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WeeklyFocus_asOf_idx" ON "WeeklyFocus"("asOf");
CREATE INDEX "DecisionDraft_weeklyFocusId_idx" ON "DecisionDraft"("weeklyFocusId");
CREATE INDEX "DecisionDraft_status_idx" ON "DecisionDraft"("status");

ALTER TABLE "DecisionDraft" ADD CONSTRAINT "DecisionDraft_weeklyFocusId_fkey" FOREIGN KEY ("weeklyFocusId") REFERENCES "WeeklyFocus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DecisionDraft" ADD CONSTRAINT "DecisionDraft_promotedDecisionId_fkey" FOREIGN KEY ("promotedDecisionId") REFERENCES "Decision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
