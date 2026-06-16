-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountStatus" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT,
ADD COLUMN     "suspendedUntil" TIMESTAMP(3);
