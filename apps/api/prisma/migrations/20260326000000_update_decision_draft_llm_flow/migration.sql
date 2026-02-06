/*
  Warnings:

  - Added the required column `keywords` to the `DecisionDraft` table without a default value. This is not possible if the table is not empty.
  - Added the required column `riskNotes` to the `DecisionDraft` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DecisionDraft" ADD COLUMN     "keywords" JSONB NOT NULL,
ADD COLUMN     "payloadSnapshot" JSONB,
ADD COLUMN     "riskNotes" TEXT NOT NULL,
ADD COLUMN     "sourceBatchId" TEXT;
