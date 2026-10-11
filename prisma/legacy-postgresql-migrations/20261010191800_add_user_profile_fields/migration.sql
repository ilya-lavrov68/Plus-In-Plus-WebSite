-- Profile fields were present in the Prisma model but absent from the initial SQL.
-- A default safely backfills updatedAt for existing accounts without resetting data.
ALTER TABLE "User"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "avatar" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
