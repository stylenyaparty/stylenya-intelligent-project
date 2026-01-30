-- DropForeignKey
ALTER TABLE "KeywordJobItem" DROP CONSTRAINT "KeywordJobItem_jobId_fkey";

-- AddForeignKey
ALTER TABLE "KeywordJobItem" ADD CONSTRAINT "KeywordJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "KeywordJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
