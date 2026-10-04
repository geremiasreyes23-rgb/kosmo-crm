-- Borrador del Reporte diario (botón "Guardar" del modal).
CREATE TABLE "DailyReportDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReportDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyReportDraft_userId_day_key" ON "DailyReportDraft"("userId", "day");

ALTER TABLE "DailyReportDraft" ADD CONSTRAINT "DailyReportDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
