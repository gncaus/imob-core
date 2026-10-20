-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "origin" TEXT,
ADD COLUMN     "originCreatedAt" TIMESTAMPTZ(3);
