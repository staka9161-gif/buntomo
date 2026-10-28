CREATE TABLE "LiteratureTree" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "literatureScope" TEXT NOT NULL,
  "countryCode" TEXT,
  "prefectureCode" TEXT,
  "era" TEXT NOT NULL,
  "mainGenreId" TEXT NOT NULL,
  "subgenreIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "customGenreTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "genreCatalogVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiteratureTree_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ForestPageOperation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readingStatusId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ForestPageOperation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ForestPageOperation_delta_check" CHECK ("delta" IN (-1, 1))
);
CREATE UNIQUE INDEX "LiteratureTree_userId_bookId_key" ON "LiteratureTree"("userId", "bookId");
CREATE UNIQUE INDEX "ForestPageOperation_userId_operationId_key" ON "ForestPageOperation"("userId", "operationId");
CREATE INDEX "ForestPageOperation_readingStatusId_idx" ON "ForestPageOperation"("readingStatusId");
ALTER TABLE "LiteratureTree" ADD CONSTRAINT "LiteratureTree_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiteratureTree" ADD CONSTRAINT "LiteratureTree_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForestPageOperation" ADD CONSTRAINT "ForestPageOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForestPageOperation" ADD CONSTRAINT "ForestPageOperation_readingStatusId_fkey" FOREIGN KEY ("readingStatusId") REFERENCES "ReadingStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
