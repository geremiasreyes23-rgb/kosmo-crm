-- CreateEnum
CREATE TYPE "RecognitionType" AS ENUM ('PERFORMANCE', 'LEADERSHIP', 'EXCELLENCE', 'GOALS', 'TEAMWORK', 'MENTOR', 'MILESTONE', 'GRATITUDE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "city" TEXT,
ADD COLUMN     "coverPhotoUrl" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "notificationLanguage" TEXT,
ADD COLUMN     "phoneExtension" TEXT,
ADD COLUMN     "supervisorId" TEXT,
ADD COLUMN     "workFormat" TEXT;

-- CreateTable
CREATE TABLE "Recognition" (
    "id" TEXT NOT NULL,
    "type" "RecognitionType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toUserId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,

    CONSTRAINT "Recognition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recognition_toUserId_idx" ON "Recognition"("toUserId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recognition" ADD CONSTRAINT "Recognition_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recognition" ADD CONSTRAINT "Recognition_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
