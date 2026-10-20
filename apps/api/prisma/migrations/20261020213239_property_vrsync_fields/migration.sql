/*
  Warnings:

  - You are about to drop the column `propertySubtype` on the `properties` table. All the data in the column will be lost.
  - You are about to alter the column `usableArea` on the `properties` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `totalArea` on the `properties` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.

*/
-- AlterTable
ALTER TABLE "properties" DROP COLUMN "propertySubtype",
ALTER COLUMN "usableArea" SET DATA TYPE INTEGER,
ALTER COLUMN "totalArea" SET DATA TYPE INTEGER;
