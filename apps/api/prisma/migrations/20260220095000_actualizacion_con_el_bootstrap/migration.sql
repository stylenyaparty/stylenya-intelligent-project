/*
  Warnings:

  - A unique constraint covering the columns `[jobId,term]` on the table `KeywordJobItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "KeywordJobItem" DROP CONSTRAINT "KeywordJobItem_jobId_fkey";

-- DropForeignKey
ALTER TABLE "PromotedKeywordSignal" DROP CONSTRAINT "PromotedKeywordSignal_jobItemId_fkey";

-- AlterTable
ALTER TABLE "KeywordJob" ALTER COLUMN "engine" DROP DEFAULT,
ALTER COLUMN "country" DROP DEFAULT,
ALTER COLUMN "providerUsed" DROP DEFAULT;

-- CreateIndex (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'KeywordJobItem_jobId_term_key'
  ) THEN
    CREATE UNIQUE INDEX "KeywordJobItem_jobId_term_key" ON "KeywordJobItem"("jobId", "term");
  END IF;
END
$$;

-- AddForeignKey
ALTER TABLE "KeywordJobItem" ADD CONSTRAINT "KeywordJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "KeywordJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotedKeywordSignal" ADD CONSTRAINT "PromotedKeywordSignal_jobItemId_fkey" FOREIGN KEY ("jobItemId") REFERENCES "KeywordJobItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

