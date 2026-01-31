-- DropIndex
DROP INDEX "Decision_decisionType_status_idx";

-- DropEnum
DROP TYPE "DecisionType";

-- CreateIndex
CREATE INDEX "Decision_status_idx" ON "Decision"("status");

-- CreateIndex
CREATE INDEX "Decision_actionType_idx" ON "Decision"("actionType");
