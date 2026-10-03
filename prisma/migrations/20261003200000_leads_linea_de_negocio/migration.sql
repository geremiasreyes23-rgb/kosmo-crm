-- Leads: estructura Cliente Común + Línea de negocio.

-- ID visible del lead ("ID de cliente", formateado L-000123).
ALTER TABLE "Lead" ADD COLUMN "leadNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "Lead_leadNumber_key" ON "Lead"("leadNumber");

-- Campos específicos de la línea de negocio seleccionada (contrato en
-- src/lib/leads/lineSchema.ts).
ALTER TABLE "Lead" ADD COLUMN "lineDetails" JSONB;

-- Datos restringidos cifrados también para Leads (antes solo Clientes).
ALTER TABLE "SensitiveField" ALTER COLUMN "clientId" DROP NOT NULL;
ALTER TABLE "SensitiveField" ADD COLUMN "leadId" TEXT;
CREATE UNIQUE INDEX "SensitiveField_leadId_fieldKey_key" ON "SensitiveField"("leadId", "fieldKey");
ALTER TABLE "SensitiveField" ADD CONSTRAINT "SensitiveField_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Los campos personalizados por línea que sembraba el seed (medicareNumber,
-- hasMedicaid, householdIncome, planType...) ahora son campos nativos del
-- formulario por línea: se ocultan para no duplicarlos. Siguen existiendo
-- (y se pueden volver a mostrar) desde Configuración → Campos personalizados.
UPDATE "CustomField" SET "isVisible" = false
WHERE "entityType" = 'LEAD'
  AND "insuranceLineId" IS NOT NULL
  AND "name" IN ('medicareNumber', 'hasMedicaid', 'currentCarrier', 'currentPlanType',
                 'householdIncome', 'householdSize', 'hasEmployerCoverage', 'planTypeInterest',
                 'planType', 'coverageType', 'rop');
