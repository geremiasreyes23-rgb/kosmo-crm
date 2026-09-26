import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import type { FamilyHeritageProfileVM } from "@/types";

const familyHeritageProfileInclude = {
  coveredMembers: true,
} satisfies Prisma.FamilyHeritageProfileInclude;

type FamilyHeritageProfileRow = Prisma.FamilyHeritageProfileGetPayload<{
  include: typeof familyHeritageProfileInclude;
}>;

function mapFamilyHeritageProfile(row: FamilyHeritageProfileRow): FamilyHeritageProfileVM {
  return {
    planType: row.planType ?? undefined,
    coverageType: row.coverageType ?? undefined,
    issueAge: row.issueAge ?? undefined,
    rop: row.rop,
    monthlyPremium: row.monthlyPremium ?? undefined,
    policyNumber: row.policyNumber ?? undefined,
    effectiveDate: row.effectiveDate ? row.effectiveDate.toISOString().slice(0, 10) : undefined,
    debitDayOfMonth: row.debitDayOfMonth ?? undefined,
    coveredMembers: row.coveredMembers.map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      dob: m.dob ? m.dob.toISOString().slice(0, 10) : undefined,
      relationship: m.relationship ?? undefined,
    })),
  };
}

/** Mismo control de alcance por rol que el resto del expediente del cliente. */
export async function getFamilyHeritageProfileForClient(
  clientId: string,
  user: SessionUser
): Promise<FamilyHeritageProfileVM | null> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return null;
  if (!canViewAll(user) && client.agentId !== user.agentId) return null;

  const row = await prisma.familyHeritageProfile.findUnique({
    where: { clientId },
    include: familyHeritageProfileInclude,
  });
  return row ? mapFamilyHeritageProfile(row) : null;
}
