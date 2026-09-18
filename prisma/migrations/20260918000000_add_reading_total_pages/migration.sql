ALTER TABLE "ReadingStatus" ADD COLUMN "totalPages" INTEGER;

-- Copy existing shared metadata once; later edits belong to the reading only.
UPDATE "ReadingStatus" AS reading
SET "totalPages" = book."totalPages"
FROM "Book" AS book
WHERE reading."bookId" = book."id"
  AND reading."totalPages" IS NULL
  AND book."totalPages" > 0;

-- Use only an explicit Edition mapping with exactly one Book, never a Work guess.
WITH unique_edition_books AS (
  SELECT book."migratedEditionId" AS "editionId", MIN(book."totalPages") AS "totalPages"
  FROM "Book" AS book
  JOIN "Edition" AS edition ON edition."id" = book."migratedEditionId"
  GROUP BY book."migratedEditionId"
  HAVING COUNT(*) = 1
)
UPDATE "ReadingStatus" AS reading
SET "totalPages" = source."totalPages"
FROM unique_edition_books AS source
WHERE reading."bookId" IS NULL
  AND reading."editionId" = source."editionId"
  AND reading."totalPages" IS NULL
  AND source."totalPages" > 0;
