-- Real, transactionally recorded actions only. No seeded activity.
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
