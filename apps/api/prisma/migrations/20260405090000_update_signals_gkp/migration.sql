ALTER TABLE "SignalBatch" RENAME COLUMN "rowCount" TO "totalRows";

ALTER TABLE "SignalBatch"
    ADD COLUMN "importedRows" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "skippedRows" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "columnsDetected" JSONB,
    ADD COLUMN "warningsJson" JSONB,
    ADD COLUMN "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "KeywordSignal" RENAME COLUMN "term" TO "keyword";
ALTER TABLE "KeywordSignal" RENAME COLUMN "termNormalized" TO "keywordNormalized";
ALTER TABLE "KeywordSignal" RENAME COLUMN "competition" TO "competitionLevel";
ALTER TABLE "KeywordSignal" RENAME COLUMN "topOfPageBidLow" TO "cpcLow";
ALTER TABLE "KeywordSignal" RENAME COLUMN "topOfPageBidHigh" TO "cpcHigh";

ALTER TABLE "KeywordSignal"
    ADD COLUMN "competitionIndex" DOUBLE PRECISION,
    ADD COLUMN "change3mPct" DOUBLE PRECISION,
    ADD COLUMN "changeYoYPct" DOUBLE PRECISION,
    ADD COLUMN "currency" TEXT,
    ADD COLUMN "monthlySearchesJson" JSONB,
    ADD COLUMN "rawRowHash" TEXT;

ALTER TABLE "KeywordSignal" DROP COLUMN "capturedAt";

DROP INDEX IF EXISTS "KeywordSignal_termNormalized_idx";
DROP INDEX IF EXISTS "KeywordSignal_source_capturedAt_idx";
DROP INDEX IF EXISTS "KeywordSignal_batchId_termNormalized_geo_language_key";

CREATE INDEX "KeywordSignal_keywordNormalized_idx" ON "KeywordSignal"("keywordNormalized");
CREATE INDEX "KeywordSignal_source_createdAt_idx" ON "KeywordSignal"("source", "createdAt");
CREATE UNIQUE INDEX "KeywordSignal_batchId_keywordNormalized_key" ON "KeywordSignal"("batchId", "keywordNormalized");
