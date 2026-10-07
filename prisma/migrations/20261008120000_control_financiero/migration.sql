-- Control Financiero (Dashboard → Control Financiero).
CREATE TYPE "FinanceKind" AS ENUM ('EXPENSE', 'INCOME');
CREATE TYPE "FinanceStatus" AS ENUM ('PAID', 'PENDING', 'SCHEDULED');
CREATE TYPE "FinancePaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'DEBIT', 'OTHER');
CREATE TYPE "FinanceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');
CREATE TYPE "FinanceRecurringStatus" AS ENUM ('ACTIVE', 'PAUSED');

CREATE TABLE "FinanceRecurringExpense" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" "FinanceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "intervalDays" INTEGER,
    "nextPaymentDate" DATE NOT NULL,
    "paymentMethod" "FinancePaymentMethod",
    "status" "FinanceRecurringStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "FinanceRecurringExpense_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "FinanceRecurringExpense" ADD CONSTRAINT "FinanceRecurringExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FinanceTransaction" (
    "id" TEXT NOT NULL,
    "kind" "FinanceKind" NOT NULL DEFAULT 'EXPENSE',
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "paymentMethod" "FinancePaymentMethod",
    "status" "FinanceStatus" NOT NULL DEFAULT 'PAID',
    "provider" TEXT,
    "notes" TEXT,
    "receiptFileName" TEXT,
    "receiptDataUrl" TEXT,
    "employeeUserId" TEXT,
    "employeeName" TEXT,
    "paymentType" TEXT,
    "recurringId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FinanceTransaction_date_idx" ON "FinanceTransaction"("date");
CREATE INDEX "FinanceTransaction_status_idx" ON "FinanceTransaction"("status");
CREATE INDEX "FinanceTransaction_kind_date_idx" ON "FinanceTransaction"("kind", "date");
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "FinanceRecurringExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Permisos: finance:view (ver) y finance:manage (registrar/editar).
-- Admin recibe ambos; Manager solo ver. Agent/Viewer, ninguno.
-- (Super Admin no depende de esta tabla: tiene acceso total.)
INSERT INTO "Permission" ("id", "resource", "action")
VALUES (gen_random_uuid()::text, 'finance', 'view'), (gen_random_uuid()::text, 'finance', 'manage')
ON CONFLICT ("resource", "action") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r JOIN "Permission" p ON p."resource" = 'finance'
WHERE r."name" = 'Admin'
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r JOIN "Permission" p ON p."resource" = 'finance' AND p."action" = 'view'
WHERE r."name" = 'Manager'
ON CONFLICT DO NOTHING;
