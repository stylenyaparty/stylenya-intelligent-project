ALTER TABLE "DecisionDraft"
ADD COLUMN "riskNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN "keywords" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "payloadSnapshot" JSONB,
ADD COLUMN "sourceBatchId" TEXT;
