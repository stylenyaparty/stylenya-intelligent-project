CREATE TABLE "SignalBatch" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "filename" TEXT,
    "status" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KeywordSignal" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "termNormalized" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "geo" TEXT,
    "language" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avgMonthlySearches" INTEGER,
    "competition" TEXT,
    "topOfPageBidLow" DOUBLE PRECISION,
    "topOfPageBidHigh" DOUBLE PRECISION,
    "rawRow" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeywordSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KeywordSignal_termNormalized_idx" ON "KeywordSignal"("termNormalized");

CREATE INDEX "KeywordSignal_source_capturedAt_idx" ON "KeywordSignal"("source", "capturedAt");

CREATE UNIQUE INDEX "KeywordSignal_batchId_termNormalized_geo_language_key" ON "KeywordSignal"("batchId", "termNormalized", "geo", "language");

ALTER TABLE "KeywordSignal" ADD CONSTRAINT "KeywordSignal_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SignalBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
