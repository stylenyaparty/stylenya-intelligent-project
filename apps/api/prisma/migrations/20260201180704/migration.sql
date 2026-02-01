-- CreateIndex (decisionType was renamed to actionType in a later migration)
CREATE INDEX "Decision_actionType_idx" ON "Decision"("decisionType");
