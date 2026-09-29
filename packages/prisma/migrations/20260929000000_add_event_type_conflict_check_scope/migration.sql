-- CreateEnum
CREATE TYPE "ConflictCheckScope" AS ENUM ('USER', 'EVENT_TYPE');

-- AlterTable
ALTER TABLE "EventType" ADD COLUMN "conflictCheckScope" "ConflictCheckScope" NOT NULL DEFAULT 'USER';
