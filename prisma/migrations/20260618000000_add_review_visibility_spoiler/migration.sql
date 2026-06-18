-- Add visibility controls for reading impressions stored in Review.
ALTER TABLE "Review" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "Review" ADD COLUMN "isSpoiler" BOOLEAN NOT NULL DEFAULT false;
