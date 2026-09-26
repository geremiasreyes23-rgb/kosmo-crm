"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, canViewAll, hasPermission } from "@/lib/auth";
import type { DependentVM, ObamacarePlanType } from "@/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface SaveObamacareProfileInput {
  age?: number;
  householdSize?: number;
  maritalStatus?: string;
  hasSpouse: boolean;
  filesJointTaxes: boolean;
  hasEmployerCoverage: boolean;

  period?: string;
  carrierId?: string;
  planName?: string;
  planType?: ObamacarePlanType;
  monthlyPremium?: number;
  marketplaceApplicationId?: string;
  marketplaceConsent: boolean;
  consentDate?: string;
  effectiveDate?: string;

  dependents: DependentVM[];
}

/** Guarda el perfil de Obamacare de un cliente — upsert 1:1 sobre
 * ObamacareProfile y patrón "borrar todo y recrear" para Dependents, igual
 * convención que el perfil de Medicare. Los campos *Ref (ingresos del
 * hogar, estatus migratorio, SSN de cada dependiente) no se tocan acá —
 * son datos financieros/restringidos que se gestionan desde el panel de
 * Datos sensibles existente en la pestaña Overview, nunca como texto plano
 * en este formulario. */
export async function saveObamacareProfileAction(
  clientId: string,
  input: SaveObamacareProfileInput
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
    age: input.age ?? null,
    householdSize: input.householdSize ?? null,
    maritalStatus: input.maritalStatus?.trim() || null,
    hasSpouse: input.hasSpouse,
    filesJointTaxes: input.filesJointTaxes,
    hasEmployerCoverage: input.hasEmployerCoverage,

    period: input.period?.trim() || null,
    carrierId: input.carrierId || null,
    planName: input.planName?.trim() || null,
    planType: input.planType || null,
    monthlyPremium: input.monthlyPremium ?? null,
    marketplaceApplicationId: input.marketplaceApplicationId?.trim() || null,
    marketplaceConsent: input.marketplaceConsent,
    consentDate: input.consentDate ? new Date(input.consentDate) : null,
    effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
  };

  const dependents = input.dependents.filter((d) => d.firstName.trim() && d.lastName.trim());

  await prisma.$transaction(async (tx) => {
    const profile = await tx.obamacareProfile.upsert({
      where: { clientId },
      update: data,
      create: { clientId, ...data },
    });

    await tx.dependent.deleteMany({ where: { obamacareProfileId: profile.id } });
    if (dependents.length) {
      await tx.dependent.createMany({
        data: dependents.map((d) => ({
          obamacareProfileId: profile.id,
          firstName: d.firstName.trim(),
          lastName: d.lastName.trim(),
          dob: d.dob ? new Date(d.dob) : null,
        })),
      });
    }
  });

  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}
