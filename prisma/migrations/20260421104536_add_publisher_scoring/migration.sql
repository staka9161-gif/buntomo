-- AlterTable
ALTER TABLE "User" ADD COLUMN "customLinks" TEXT;
ALTER TABLE "User" ADD COLUMN "linkInstagram" TEXT;
ALTER TABLE "User" ADD COLUMN "linkWebsite" TEXT;
ALTER TABLE "User" ADD COLUMN "linkX" TEXT;

-- CreateTable
CREATE TABLE "PublisherTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publisherNameNormalized" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "labelNameNormalized" TEXT,
    "labelDisplayName" TEXT
);

-- CreateTable
CREATE TABLE "ReadingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "prefecture" TEXT NOT NULL DEFAULT '東京都',
    "location" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReadingEvent_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReadingEvent_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_EventBooks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_EventBooks_A_fkey" FOREIGN KEY ("A") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_EventBooks_B_fkey" FOREIGN KEY ("B") REFERENCES "ReadingEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "isbn" TEXT,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "publisher" TEXT,
    "publisherNormalized" TEXT,
    "label" TEXT,
    "labelNormalized" TEXT,
    "publishedDate" TEXT,
    "totalPages" INTEGER NOT NULL,
    "coverImageUrl" TEXT,
    "description" TEXT,
    "publisherTier" TEXT NOT NULL DEFAULT 'C',
    "publisherScore" INTEGER NOT NULL DEFAULT 0,
    "completenessScore" INTEGER NOT NULL DEFAULT 0,
    "registrationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Book" ("author", "coverImageUrl", "createdAt", "description", "id", "isbn", "title", "totalPages") SELECT "author", "coverImageUrl", "createdAt", "description", "id", "isbn", "title", "totalPages" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
CREATE UNIQUE INDEX "Book_isbn_key" ON "Book"("isbn");
CREATE INDEX "Book_title_idx" ON "Book"("title");
CREATE INDEX "Book_author_idx" ON "Book"("author");
CREATE INDEX "Book_publisherNormalized_idx" ON "Book"("publisherNormalized");
CREATE INDEX "Book_labelNormalized_idx" ON "Book"("labelNormalized");
CREATE TABLE "new_ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "window" TEXT NOT NULL DEFAULT '1w',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ChatMessage" ("bookId", "content", "createdAt", "id", "userId") SELECT "bookId", "content", "createdAt", "id", "userId" FROM "ChatMessage";
DROP TABLE "ChatMessage";
ALTER TABLE "new_ChatMessage" RENAME TO "ChatMessage";
CREATE INDEX "ChatMessage_bookId_window_createdAt_idx" ON "ChatMessage"("bookId", "window", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PublisherTier_publisherNameNormalized_key" ON "PublisherTier"("publisherNameNormalized");

-- CreateIndex
CREATE INDEX "PublisherTier_tier_idx" ON "PublisherTier"("tier");

-- CreateIndex
CREATE INDEX "ReadingEvent_bookId_eventDate_idx" ON "ReadingEvent"("bookId", "eventDate");

-- CreateIndex
CREATE INDEX "ReadingEvent_eventDate_idx" ON "ReadingEvent"("eventDate");

-- CreateIndex
CREATE INDEX "ReadingEvent_prefecture_idx" ON "ReadingEvent"("prefecture");

-- CreateIndex
CREATE UNIQUE INDEX "_EventBooks_AB_unique" ON "_EventBooks"("A", "B");

-- CreateIndex
CREATE INDEX "_EventBooks_B_index" ON "_EventBooks"("B");
