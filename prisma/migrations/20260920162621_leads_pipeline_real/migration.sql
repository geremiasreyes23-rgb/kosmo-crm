-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "interestedLineId" TEXT;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_interestedLineId_fkey" FOREIGN KEY ("interestedLineId") REFERENCES "InsuranceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
