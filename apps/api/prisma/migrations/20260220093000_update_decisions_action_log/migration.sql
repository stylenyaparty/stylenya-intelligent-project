-- Drop FK to Product since decisions are now generic action logs
ALTER TABLE "Decision" DROP CONSTRAINT IF EXISTS "Decision_productId_fkey";

-- Rename decisionType -> actionType and move to text
ALTER TABLE "Decision" RENAME COLUMN "decisionType" TO "actionType";
ALTER TABLE "Decision" ALTER COLUMN "actionType" TYPE TEXT USING "actionType"::text;

-- Allow rationale to be nullable
ALTER TABLE "Decision" ALTER COLUMN "rationale" DROP NOT NULL;

-- Add new fields for Weekly Focus decisions
ALTER TABLE "Decision"
    ADD COLUMN IF NOT EXISTS "targetType" "DecisionTargetType",
    ADD COLUMN IF NOT EXISTS "targetId" TEXT,
    ADD COLUMN IF NOT EXISTS "title" TEXT,
    ADD COLUMN IF NOT EXISTS "priorityScore" INTEGER,
    ADD COLUMN IF NOT EXISTS "sources" JSONB;

-- Backfill title for any existing rows
UPDATE "Decision"
SET "title" = COALESCE("title", "rationale", 'Decision')
WHERE "title" IS NULL;

-- Make title required
ALTER TABLE "Decision" ALTER COLUMN "title" SET NOT NULL;

-- Drop legacy fields no longer used
ALTER TABLE "Decision"
    DROP COLUMN IF EXISTS "productId",
    DROP COLUMN IF EXISTS "expectedImpact",
    DROP COLUMN IF EXISTS "engineVersion",
    DROP COLUMN IF EXISTS "engineSnapshot";

-- Ensure DecisionTargetType supports keyword targets
ALTER TYPE "DecisionTargetType" ADD VALUE IF NOT EXISTS 'KEYWORD';
