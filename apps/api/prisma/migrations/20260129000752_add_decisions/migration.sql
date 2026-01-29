-- AlterTable
ALTER TABLE "Decision" ADD COLUMN     "engineSnapshot" JSONB,
ADD COLUMN     "engineVersion" TEXT NOT NULL DEFAULT 'v1';
