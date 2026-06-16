-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EditionFormat" AS ENUM ('hardcover', 'paperback', 'bunko', 'shinsho', 'ebook', 'audiobook', 'other');

-- CreateEnum
CREATE TYPE "EditionSource" AS ENUM ('ndl', 'openbd', 'google_books', 'rakuten', 'manual', 'user_submitted');

-- CreateEnum
CREATE TYPE "MergeSuggestionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ReadingStatusType" AS ENUM ('WANT_TO_READ', 'READING', 'COMPLETED', 'DNF');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "handle" TEXT,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "bio" TEXT,
    "linkX" TEXT,
    "linkInstagram" TEXT,
    "linkWebsite" TEXT,
    "linkWebsiteLabel" TEXT,
    "area" TEXT,
    "customLinks" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT,
    "emailNotifDM" BOOLEAN NOT NULL DEFAULT true,
    "emailNotifFriendRequest" BOOLEAN NOT NULL DEFAULT true,
    "emailNotifFriendAccepted" BOOLEAN NOT NULL DEFAULT true,
    "notificationsLastSeenAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "scheduledDeletionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
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
    "migratedWorkId" TEXT,
    "migratedEditionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleNormalized" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL,
    "authorNormalized" TEXT NOT NULL DEFAULT '',
    "originalTitle" TEXT,
    "originalLanguage" TEXT,
    "description" TEXT,
    "ndlWorkId" TEXT,
    "openlibraryWorkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edition" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "translationGroupId" TEXT,
    "isbn10" TEXT,
    "isbn13" TEXT,
    "publisher" TEXT,
    "format" "EditionFormat" NOT NULL DEFAULT 'other',
    "pageCount" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "coverImageUrl" TEXT,
    "titleOnCover" TEXT NOT NULL,
    "source" "EditionSource" NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Edition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslationGroup" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "translator" TEXT,
    "translatorNormalized" TEXT,
    "label" TEXT NOT NULL,
    "firstPublishedYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "editionId" TEXT,
    "body" TEXT NOT NULL,
    "rating" INTEGER,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MergeSuggestion" (
    "id" TEXT NOT NULL,
    "sourceWorkId" TEXT NOT NULL,
    "targetWorkId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "reason" TEXT,
    "status" "MergeSuggestionStatus" NOT NULL DEFAULT 'pending',
    "reporterUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MergeSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT,
    "workId" TEXT,
    "editionId" TEXT,
    "status" "ReadingStatusType" NOT NULL,
    "currentPage" INTEGER NOT NULL DEFAULT 0,
    "rating" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingEvent" (
    "id" TEXT NOT NULL,
    "bookId" TEXT,
    "workId" TEXT,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "prefecture" TEXT NOT NULL DEFAULT '東京都',
    "location" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "bookId" TEXT,
    "workId" TEXT,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "window" TEXT NOT NULL DEFAULT '1w',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchCache" (
    "queryHash" TEXT NOT NULL,
    "queryRaw" TEXT NOT NULL,
    "queryNormalized" TEXT NOT NULL,
    "resultIsbns" TEXT[],
    "resultScores" DOUBLE PRECISION[],
    "sourcesUsed" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchCache_pkey" PRIMARY KEY ("queryHash")
);

-- CreateTable
CREATE TABLE "LearningSignal" (
    "id" TEXT NOT NULL,
    "queryNormalized" TEXT NOT NULL,
    "isbn" TEXT,
    "bookId" TEXT,
    "rankShown" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EventBooks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EventBooks_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Book_isbn_key" ON "Book"("isbn");

-- CreateIndex
CREATE INDEX "Book_title_idx" ON "Book"("title");

-- CreateIndex
CREATE INDEX "Book_titleNormalized_idx" ON "Book"("titleNormalized");

-- CreateIndex
CREATE INDEX "Book_author_idx" ON "Book"("author");

-- CreateIndex
CREATE INDEX "Book_publisherNormalized_idx" ON "Book"("publisherNormalized");

-- CreateIndex
CREATE INDEX "Book_labelNormalized_idx" ON "Book"("labelNormalized");

-- CreateIndex
CREATE INDEX "Book_customRank_idx" ON "Book"("customRank");

-- CreateIndex
CREATE INDEX "Book_seriesName_idx" ON "Book"("seriesName");

-- CreateIndex
CREATE INDEX "Work_titleNormalized_idx" ON "Work"("titleNormalized");

-- CreateIndex
CREATE INDEX "Work_authorNormalized_idx" ON "Work"("authorNormalized");

-- CreateIndex
CREATE INDEX "Work_ndlWorkId_idx" ON "Work"("ndlWorkId");

-- CreateIndex
CREATE INDEX "Work_openlibraryWorkId_idx" ON "Work"("openlibraryWorkId");

-- CreateIndex
CREATE INDEX "Work_originalTitle_idx" ON "Work"("originalTitle");

-- CreateIndex
CREATE UNIQUE INDEX "Edition_isbn13_key" ON "Edition"("isbn13");

-- CreateIndex
CREATE INDEX "Edition_workId_idx" ON "Edition"("workId");

-- CreateIndex
CREATE INDEX "Edition_translationGroupId_idx" ON "Edition"("translationGroupId");

-- CreateIndex
CREATE INDEX "Edition_isbn13_idx" ON "Edition"("isbn13");

-- CreateIndex
CREATE INDEX "TranslationGroup_workId_idx" ON "TranslationGroup"("workId");

-- CreateIndex
CREATE INDEX "Review_workId_idx" ON "Review"("workId");

-- CreateIndex
CREATE INDEX "Review_editionId_idx" ON "Review"("editionId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_workId_key" ON "Review"("userId", "workId");

-- CreateIndex
CREATE INDEX "MergeSuggestion_status_idx" ON "MergeSuggestion"("status");

-- CreateIndex
CREATE INDEX "MergeSuggestion_sourceWorkId_idx" ON "MergeSuggestion"("sourceWorkId");

-- CreateIndex
CREATE INDEX "MergeSuggestion_targetWorkId_idx" ON "MergeSuggestion"("targetWorkId");

-- CreateIndex
CREATE INDEX "ReadingStatus_bookId_status_idx" ON "ReadingStatus"("bookId", "status");

-- CreateIndex
CREATE INDEX "ReadingStatus_bookId_completedAt_idx" ON "ReadingStatus"("bookId", "completedAt");

-- CreateIndex
CREATE INDEX "ReadingStatus_workId_status_idx" ON "ReadingStatus"("workId", "status");

-- CreateIndex
CREATE INDEX "ReadingStatus_editionId_idx" ON "ReadingStatus"("editionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingStatus_userId_bookId_key" ON "ReadingStatus"("userId", "bookId");

-- CreateIndex
CREATE INDEX "ReadingEvent_bookId_eventDate_idx" ON "ReadingEvent"("bookId", "eventDate");

-- CreateIndex
CREATE INDEX "ReadingEvent_workId_eventDate_idx" ON "ReadingEvent"("workId", "eventDate");

-- CreateIndex
CREATE INDEX "ReadingEvent_eventDate_idx" ON "ReadingEvent"("eventDate");

-- CreateIndex
CREATE INDEX "ReadingEvent_prefecture_idx" ON "ReadingEvent"("prefecture");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_token_idx" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Friendship_addresseeId_status_idx" ON "Friendship"("addresseeId", "status");

-- CreateIndex
CREATE INDEX "Friendship_requesterId_status_idx" ON "Friendship"("requesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "ChatMessage_bookId_window_createdAt_idx" ON "ChatMessage"("bookId", "window", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_workId_window_createdAt_idx" ON "ChatMessage"("workId", "window", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_senderId_recipientId_createdAt_idx" ON "DirectMessage"("senderId", "recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_recipientId_senderId_createdAt_idx" ON "DirectMessage"("recipientId", "senderId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchCache_expiresAt_idx" ON "SearchCache"("expiresAt");

-- CreateIndex
CREATE INDEX "LearningSignal_queryNormalized_idx" ON "LearningSignal"("queryNormalized");

-- CreateIndex
CREATE INDEX "LearningSignal_isbn_idx" ON "LearningSignal"("isbn");

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "_EventBooks_B_index" ON "_EventBooks"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_translationGroupId_fkey" FOREIGN KEY ("translationGroupId") REFERENCES "TranslationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslationGroup" ADD CONSTRAINT "TranslationGroup_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeSuggestion" ADD CONSTRAINT "MergeSuggestion_sourceWorkId_fkey" FOREIGN KEY ("sourceWorkId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeSuggestion" ADD CONSTRAINT "MergeSuggestion_targetWorkId_fkey" FOREIGN KEY ("targetWorkId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeSuggestion" ADD CONSTRAINT "MergeSuggestion_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingStatus" ADD CONSTRAINT "ReadingStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingStatus" ADD CONSTRAINT "ReadingStatus_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingStatus" ADD CONSTRAINT "ReadingStatus_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingStatus" ADD CONSTRAINT "ReadingStatus_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingEvent" ADD CONSTRAINT "ReadingEvent_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingEvent" ADD CONSTRAINT "ReadingEvent_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingEvent" ADD CONSTRAINT "ReadingEvent_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventBooks" ADD CONSTRAINT "_EventBooks_A_fkey" FOREIGN KEY ("A") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventBooks" ADD CONSTRAINT "_EventBooks_B_fkey" FOREIGN KEY ("B") REFERENCES "ReadingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
