"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, canViewAll, hasPermission } from "@/lib/auth";
import type { CoveredMemberVM, FamilyHeritagePlan, FamilyHeritageCoverage } from "@/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface SaveFamilyHeritageProfileInput {
  planType?: FamilyHeritagePlan;
  coverageType?: FamilyHeritageCoverage;
  issueAge?: number;
  rop: boolean;
  monthlyPremium?: number;
  policyNumber?: string;
  effectiveDate?: string;
  debitDayOfMonth?: number;
  coveredMembers: CoveredMemberVM[];
}

/** Guarda el perfil de Family Heritage de un cliente — upsert 1:1 sobre
 * FamilyHeritageProfile y patrón "borrar todo y recrear" para
 * CoveredMember, misma convención que Medicare/Obamacare. Los campos *Ref
 * (datos bancarios de domiciliación, SSN de cada miembro cubierto) no se
 * tocan acá — se gestionan desde el panel de Datos sensibles en Overview. */
export async function saveFamilyHeritageProfileAction(
  clientId: string,
  input: SaveFamilyHeritageProfileInput
): Promise<ActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "clients", "edit")) {
    return { ok: false, error: "No tienes permiso para editar el expediente de este cliente." };
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { ok: false, error: "El cliente ya no existe." };
  if (!canViewAll(user) && client.agentId !== user.agentId) {
    return { ok: false, error: "No puedes editar clientes de otro vendedor." };
  }

  const data = {
    planType: input.planType || null,
    coverageType: input.coverageType || null,
    issueAge: input.issueAge ?? null,
    rop: input.rop,
    monthlyPremium: input.monthlyPremium ?? null,
    policyNumber: input.policyNumber?.trim() || null,
    effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
    debitDayOfMonth: input.debitDayOfMonth ?? null,
  };

  const coveredMembers = input.coveredMembers.filter((m) => m.firstName.trim() && m.lastName.trim());

  await prisma.$transaction(async (tx) => {
    const profile = await tx.familyHeritageProfile.upsert({
      where: { clientId },
      update: data,
      create: { clientId, ...data },
    });

    await tx.coveredMember.deleteMany({ where: { profileId: profile.id } });
    if (coveredMembers.length) {
      await tx.coveredMember.createMany({
        data: coveredMembers.map((m) => ({
          profileId: profile.id,
          firstName: m.firstName.trim(),
          lastName: m.lastName.trim(),
          dob: m.dob ? new Date(m.dob) : null,
          relationship: m.relationship?.trim() || null,
        })),
      });
    }
  });

  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}
