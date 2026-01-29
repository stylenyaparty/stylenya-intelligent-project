-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('BOOST', 'KEEP', 'PAUSE', 'RETIRE', 'MIGRATE', 'LAUNCH', 'PROMOTE');

-- CreateEnum
CREATE TYPE "DecisionTargetType" AS ENUM ('PRODUCT', 'THEME');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('PLANNED', 'EXECUTED', 'MEASURED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "decisionType" "DecisionType" NOT NULL,
    "targetType" "DecisionTargetType" NOT NULL,
    "rationale" TEXT NOT NULL,
    "expectedImpact" TEXT,
    "status" "DecisionStatus" NOT NULL DEFAULT 'PLANNED',
    "productId" TEXT,
    "theme" TEXT,
    "llmUsed" BOOLEAN NOT NULL DEFAULT false,
    "llmSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Decision_createdAt_idx" ON "Decision"("createdAt");

-- CreateIndex
CREATE INDEX "Decision_decisionType_status_idx" ON "Decision"("decisionType", "status");

-- CreateIndex
CREATE INDEX "Decision_productId_idx" ON "Decision"("productId");

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
