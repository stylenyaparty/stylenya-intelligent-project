ALTER TABLE "KeywordJob" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "KeywordJob_archivedAt_idx" ON "KeywordJob"("archivedAt");
