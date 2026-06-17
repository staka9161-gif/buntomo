-- CreateTable
CREATE TABLE "SuspensionAppeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT NOT NULL,
    "adminUserId" TEXT,
    "adminNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuspensionAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuspensionAppeal_userId_idx" ON "SuspensionAppeal"("userId");

-- CreateIndex
CREATE INDEX "SuspensionAppeal_status_idx" ON "SuspensionAppeal"("status");

-- CreateIndex
CREATE INDEX "SuspensionAppeal_createdAt_idx" ON "SuspensionAppeal"("createdAt");

-- CreateIndex
CREATE INDEX "SuspensionAppeal_adminUserId_idx" ON "SuspensionAppeal"("adminUserId");

-- AddForeignKey
ALTER TABLE "SuspensionAppeal" ADD CONSTRAINT "SuspensionAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspensionAppeal" ADD CONSTRAINT "SuspensionAppeal_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
