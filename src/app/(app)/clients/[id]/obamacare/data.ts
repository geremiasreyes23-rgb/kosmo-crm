import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import type { ObamacareProfileVM } from "@/types";

const obamacareProfileInclude = {
  dependents: true,
} satisfies Prisma.ObamacareProfileInclude;

type ObamacareProfileRow = Prisma.ObamacareProfileGetPayload<{ include: typeof obamacareProfileInclude }>;

function mapObamacareProfile(row: ObamacareProfileRow): ObamacareProfileVM {
  return {
    age: row.age ?? undefined,
    householdSize: row.householdSize ?? undefined,
    maritalStatus: row.maritalStatus ?? undefined,
    hasSpouse: row.hasSpouse,
    filesJointTaxes: row.filesJointTaxes,
    hasEmployerCoverage: row.hasEmployerCoverage,

    period: row.period ?? undefined,
    carrierId: row.carrierId ?? undefined,
    planName: row.planName ?? undefined,
    planType: row.planType ?? undefined,
    monthlyPremium: row.monthlyPremium ?? undefined,
    marketplaceApplicationId: row.marketplaceApplicationId ?? undefined,
    marketplaceConsent: row.marketplaceConsent,
    consentDate: row.consentDate ? row.consentDate.toISOString().slice(0, 10) : undefined,
    effectiveDate: row.effectiveDate ? row.effectiveDate.toISOString().slice(0, 10) : undefined,

    dependents: row.dependents.map((d) => ({
      id: d.id,
      firstName: d.firstName,
      lastName: d.lastName,
      dob: d.dob ? d.dob.toISOString().slice(0, 10) : undefined,
    })),
  };
}

/** Mismo control de alcance por rol que el resto del expediente del cliente
 * — null tanto si el cliente no existe/no tiene perfil como si el usuario no
 * tiene permiso de verlo. */
export async function getObamacareProfileForClient(
  clientId: string,
  user: SessionUser
): Promise<ObamacareProfileVM | null> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return null;
  if (!canViewAll(user) && client.agentId !== user.agentId) return null;

  const row = await prisma.obamacareProfile.findUnique({
    where: { clientId },
    include: obamacareProfileInclude,
  });
  return row ? mapObamacareProfile(row) : null;
}


export interface ObamacareFormOptions {
  carriers: { id: string; name: string }[];
}

/** Carriers activos que efectivamente ofrecen Obamacare — mismo catálogo
 * sembrado en prisma/seed.ts (Carrier + CarrierInsuranceLine). */
export async function getObamacareFormOptions(): Promise<ObamacareFormOptions> {
  const line = await prisma.insuranceLine.findUnique({ where: { code: "OBAMACARE" } });
  const carriers = await prisma.carrier.findMany({
    where: { status: "ACTIVE", ...(line ? { lines: { some: { insuranceLineId: line.id } } } : {}) },
    orderBy: { name: "asc" },
  });
  return { carriers: carriers.map((c) => ({ id: c.id, name: c.name })) };
}
