-- Add dedupeKey to Decision
ALTER TABLE "Decision" ADD COLUMN "dedupeKey" TEXT;

UPDATE "Decision"
SET "dedupeKey" = concat_ws(
    '|',
    "actionType",
    COALESCE("targetType"::text, ''),
    COALESCE("targetId", ''),
    to_char(date_trunc('week', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD'),
    COALESCE(
        (
            SELECT string_agg(value::text, ', ' ORDER BY value::text)
            FROM jsonb_array_elements(COALESCE("sources", '[]'::jsonb)) AS value
        ),
        ''
    )
)
WHERE "dedupeKey" IS NULL;

ALTER TABLE "Decision" ALTER COLUMN "dedupeKey" SET NOT NULL;

CREATE UNIQUE INDEX "Decision_dedupeKey_key" ON "Decision"("dedupeKey");
