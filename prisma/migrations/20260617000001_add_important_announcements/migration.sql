-- CreateTable
CREATE TABLE "ImportantAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "level" TEXT NOT NULL DEFAULT 'important',
    "createdById" TEXT,
    "updatedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportantAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportantAnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportantAnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportantAnnouncement_status_idx" ON "ImportantAnnouncement"("status");

-- CreateIndex
CREATE INDEX "ImportantAnnouncement_publishedAt_idx" ON "ImportantAnnouncement"("publishedAt");

-- CreateIndex
CREATE INDEX "ImportantAnnouncement_expiresAt_idx" ON "ImportantAnnouncement"("expiresAt");

-- CreateIndex
CREATE INDEX "ImportantAnnouncement_createdById_idx" ON "ImportantAnnouncement"("createdById");

-- CreateIndex
CREATE INDEX "ImportantAnnouncement_updatedById_idx" ON "ImportantAnnouncement"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "ImportantAnnouncementRead_announcementId_userId_key" ON "ImportantAnnouncementRead"("announcementId", "userId");

-- CreateIndex
CREATE INDEX "ImportantAnnouncementRead_userId_idx" ON "ImportantAnnouncementRead"("userId");

-- CreateIndex
CREATE INDEX "ImportantAnnouncementRead_announcementId_idx" ON "ImportantAnnouncementRead"("announcementId");

-- AddForeignKey
ALTER TABLE "ImportantAnnouncement" ADD CONSTRAINT "ImportantAnnouncement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportantAnnouncement" ADD CONSTRAINT "ImportantAnnouncement_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportantAnnouncementRead" ADD CONSTRAINT "ImportantAnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "ImportantAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportantAnnouncementRead" ADD CONSTRAINT "ImportantAnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
