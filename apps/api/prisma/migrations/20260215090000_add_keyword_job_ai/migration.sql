-- Add AI job mode and keyword item source
ALTER TYPE "KeywordJobMode" ADD VALUE 'AI';
ALTER TYPE "KeywordJobItemSource" ADD VALUE 'AI';

-- Extend KeywordJob with AI fields
ALTER TABLE "KeywordJob" ADD COLUMN "topic" TEXT;
ALTER TABLE "KeywordJob" ADD COLUMN "max" INTEGER DEFAULT 10;
