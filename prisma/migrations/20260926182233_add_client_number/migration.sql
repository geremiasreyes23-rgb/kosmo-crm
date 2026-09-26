/*
  Warnings:

  - A unique constraint covering the columns `[clientNumber]` on the table `Client` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "clientNumber" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Client_clientNumber_key" ON "Client"("clientNumber");
