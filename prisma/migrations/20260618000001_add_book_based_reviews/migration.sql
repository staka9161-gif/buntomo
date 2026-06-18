-- Allow completed-book impressions to be attached directly to a Book when no Work exists.
ALTER TABLE "Review" ALTER COLUMN "workId" DROP NOT NULL;
ALTER TABLE "Review" ADD COLUMN "bookId" TEXT;

CREATE UNIQUE INDEX "Review_userId_bookId_key" ON "Review"("userId", "bookId");
CREATE INDEX "Review_bookId_idx" ON "Review"("bookId");

ALTER TABLE "Review" ADD CONSTRAINT "Review_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
