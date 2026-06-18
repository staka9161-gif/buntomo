-- CreateTable
CREATE TABLE "UpdateNotice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'お知らせ',
    "topicTag" TEXT,
    "href" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "displayDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpdateNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UpdateNotice_status_idx" ON "UpdateNotice"("status");

-- CreateIndex
CREATE INDEX "UpdateNotice_displayDate_idx" ON "UpdateNotice"("displayDate");

-- CreateIndex
CREATE INDEX "UpdateNotice_type_idx" ON "UpdateNotice"("type");

-- CreateIndex
CREATE INDEX "UpdateNotice_topicTag_idx" ON "UpdateNotice"("topicTag");

-- CreateIndex
CREATE INDEX "UpdateNotice_createdById_idx" ON "UpdateNotice"("createdById");

-- CreateIndex
CREATE INDEX "UpdateNotice_updatedById_idx" ON "UpdateNotice"("updatedById");

-- AddForeignKey
ALTER TABLE "UpdateNotice" ADD CONSTRAINT "UpdateNotice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpdateNotice" ADD CONSTRAINT "UpdateNotice_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
