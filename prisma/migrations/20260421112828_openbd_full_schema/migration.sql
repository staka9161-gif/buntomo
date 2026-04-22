/*
  Warnings:

  - You are about to drop the `PublisherTier` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "PublisherTier_tier_idx";

-- DropIndex
DROP INDEX "PublisherTier_publisherNameNormalized_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PublisherTier";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "isbn" TEXT,
    "title" TEXT NOT NULL,
    "titleNormalized" TEXT NOT NULL DEFAULT '',
    "titleKana" TEXT,
    "subtitle" TEXT,
    "seriesName" TEXT,
    "volume" TEXT,
    "author" TEXT NOT NULL,
    "authorKana" TEXT,
    "publisher" TEXT,
    "publisherNormalized" TEXT,
    "label" TEXT,
    "labelNormalized" TEXT,
    "publishedDate" TEXT,
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "coverImageUrl" TEXT,
    "coverSource" TEXT,
    "description" TEXT,
    "sourceData" TEXT,
    "publisherTier" TEXT NOT NULL DEFAULT 'C',
    "publisherScore" INTEGER NOT NULL DEFAULT 0,
    "popularityScore" INTEGER NOT NULL DEFAULT 0,
    "completenessScore" INTEGER NOT NULL DEFAULT 0,
    "freshnessScore" INTEGER NOT NULL DEFAULT 0,
    "customRank" INTEGER NOT NULL DEFAULT 0,
    "isCanonical" BOOLEAN NOT NULL DEFAULT true,
    "isElectronic" BOOLEAN NOT NULL DEFAULT false,
    "isKarilRecommended" BOOLEAN NOT NULL DEFAULT false,
    "isLongseller" BOOLEAN NOT NULL DEFAULT false,
    "registrationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Book" ("author", "completenessScore", "coverImageUrl", "createdAt", "description", "id", "isbn", "label", "labelNormalized", "publishedDate", "publisher", "publisherNormalized", "publisherScore", "publisherTier", "registrationCount", "title", "totalPages") SELECT "author", "completenessScore", "coverImageUrl", "createdAt", "description", "id", "isbn", "label", "labelNormalized", "publishedDate", "publisher", "publisherNormalized", "publisherScore", "publisherTier", "registrationCount", "title", "totalPages" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
CREATE UNIQUE INDEX "Book_isbn_key" ON "Book"("isbn");
CREATE INDEX "Book_title_idx" ON "Book"("title");
CREATE INDEX "Book_titleNormalized_idx" ON "Book"("titleNormalized");
CREATE INDEX "Book_author_idx" ON "Book"("author");
CREATE INDEX "Book_publisherNormalized_idx" ON "Book"("publisherNormalized");
CREATE INDEX "Book_labelNormalized_idx" ON "Book"("labelNormalized");
CREATE INDEX "Book_customRank_idx" ON "Book"("customRank");
CREATE INDEX "Book_seriesName_idx" ON "Book"("seriesName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
