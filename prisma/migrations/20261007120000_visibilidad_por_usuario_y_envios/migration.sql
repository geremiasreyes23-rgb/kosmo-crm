-- Visibilidad por persona (excepciones respecto del rol).
CREATE TABLE "UserVisibilityOverride" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL,

    CONSTRAINT "UserVisibilityOverride_pkey" PRIMARY KEY ("userId","key")
);
ALTER TABLE "UserVisibilityOverride" ADD CONSTRAINT "UserVisibilityOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Envíos (submisiones) de leads.
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED');
ALTER TABLE "Lead" ADD COLUMN "submissionStatus" "SubmissionStatus";
ALTER TABLE "Lead" ADD COLUMN "submissionRequestedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "submissionRequestedById" TEXT;
ALTER TABLE "Lead" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "submittedById" TEXT;
ALTER TABLE "Lead" ADD COLUMN "submissionNotes" TEXT;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Lead_submissionStatus_idx" ON "Lead"("submissionStatus");

-- El módulo "Envíos" arranca oculto para todos los roles; se habilita por
-- rol (Roles y permisos) o por persona (Visibilidad por usuario).
INSERT INTO "RoleModuleVisibility" ("roleId", "moduleKey", "visible")
SELECT "id", '/submissions', false FROM "Role"
ON CONFLICT DO NOTHING;
