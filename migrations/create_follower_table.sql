-- Create Follower table for Tribeo
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/pjynycglynfwerripcjp/sql

CREATE TABLE IF NOT EXISTS "Follower" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follower_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Follower_followerId_followingId_key" ON "Follower"("followerId", "followingId");
CREATE INDEX IF NOT EXISTS "Follower_followerId_idx" ON "Follower"("followerId");
CREATE INDEX IF NOT EXISTS "Follower_followingId_idx" ON "Follower"("followingId");

ALTER TABLE "Follower" ADD CONSTRAINT "Follower_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Follower" ADD CONSTRAINT "Follower_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
