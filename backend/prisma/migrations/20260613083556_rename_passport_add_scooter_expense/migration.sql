/*
  Warnings:

  - You are about to drop the column `passportImageBack` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `passportImageFront` on the `bookings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "passportImageBack",
DROP COLUMN "passportImageFront",
ADD COLUMN     "idpPhoto" TEXT,
ADD COLUMN     "passportPhoto" TEXT;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "scooterId" TEXT;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_scooterId_fkey" FOREIGN KEY ("scooterId") REFERENCES "scooters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
