-- CreateTable
CREATE TABLE "ReadingEventInterest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingEventInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReadingEventInterest_eventId_userId_key" ON "ReadingEventInterest"("eventId", "userId");

-- CreateIndex
CREATE INDEX "ReadingEventInterest_eventId_idx" ON "ReadingEventInterest"("eventId");

-- CreateIndex
CREATE INDEX "ReadingEventInterest_userId_idx" ON "ReadingEventInterest"("userId");

-- CreateIndex
CREATE INDEX "ReadingEventInterest_createdAt_idx" ON "ReadingEventInterest"("createdAt");

-- AddForeignKey
ALTER TABLE "ReadingEventInterest" ADD CONSTRAINT "ReadingEventInterest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ReadingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingEventInterest" ADD CONSTRAINT "ReadingEventInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
