-- Convert DecisionType enum column to TEXT first, then drop the enum
ALTER TABLE "Decision" ALTER COLUMN "decisionType" TYPE TEXT USING "decisionType"::text;

-- DropIndex
DROP INDEX IF EXISTS "Decision_decisionType_status_idx";

-- DropEnum
DROP TYPE IF EXISTS "DecisionType";

-- CreateIndex for status (actionType will be added later when column exists)
CREATE INDEX IF NOT EXISTS "Decision_status_idx" ON "Decision"("status");
