"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, canViewAll, hasPermission } from "@/lib/auth";
import type {
  MedicareConditionVM,
  MedicareMedicationVM,
  MedicareSpecialistVM,
  MedicarePlanType,
  MedicarePresentationMethod,
} from "@/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface SaveMedicareProfileInput {
  hasMedicaid: boolean;
  dualClassification?: string;
  qmb: boolean;
  fbde: boolean;
  slmb: boolean;
  extraHelp: boolean;

  healthRating?: number;
  weight?: number;
  height?: number;
  homeAttendant: boolean;
  homeAttendantCompany?: string;
  hasCancer: boolean;
  onDialysis: boolean;

  primaryDoctorName?: string;
  primaryDoctorAddress?: string;
  primaryDoctorPhone?: string;
  preferredPharmacy?: string;

  currentCarrierId?: string;
  currentPlanName?: string;
  currentPlanType?: MedicarePlanType;
  offeredCarrierId?: string;
  offeredPlanName?: string;
  offeredPlanType?: MedicarePlanType;
  changeReason?: string;
  electionPeriod?: string;
  presentationMethod?: MedicarePresentationMethod;

  soaSigned: boolean;
  soaDate?: string;
  soaMethod?: string;
  callRecordingUrl?: string;

  effectiveDate?: string;
  confirmationNumber?: string;

  poa: boolean;
  poaFirstName?: string;
  poaLastName?: string;
  poaAddress?: string;
  poaPhone?: string;
  poaRelationship?: string;

  currentAor: boolean;
  currentAorName?: string;
  acceptsAgentChange: boolean;
  acceptsPlanChange: boolean;
  signatureUrl?: string;

  conditions: MedicareConditionVM[];
  medications: MedicareMedicationVM[];
  specialists: MedicareSpecialistVM[];
}

/** Guarda el perfil de Medicare Advantage de un cliente — upsert 1:1 sobre
 * MedicareProfile, y patrón "borrar todo y recrear" para las tres
 * colecciones hijas (Condiciones/Medicamentos/Especialistas): más simple y
 * suficientemente eficiente para listas cortas manejadas desde un solo
 * formulario, evita reconciliar altas/bajas/ediciones fila por fila. Los
 * campos *Ref (número de Medicare/Medicaid) no se tocan acá — se gestionan
 * desde el panel de Datos sensibles existente en la pestaña Overview. */
export async function saveMedicareProfileAction(
  clientId: string,
  input: SaveMedicareProfileInput
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
    hasMedicaid: input.hasMedicaid,
    dualClassification: input.dualClassification?.trim() || null,
    qmb: input.qmb,
    fbde: input.fbde,
    slmb: input.slmb,
    extraHelp: input.extraHelp,

    healthRating: input.healthRating ?? null,
    weight: input.weight ?? null,
    height: input.height ?? null,
    homeAttendant: input.homeAttendant,
    homeAttendantCompany: input.homeAttendantCompany?.trim() || null,
    hasCancer: input.hasCancer,
    onDialysis: input.onDialysis,

    primaryDoctorName: input.primaryDoctorName?.trim() || null,
    primaryDoctorAddress: input.primaryDoctorAddress?.trim() || null,
    primaryDoctorPhone: input.primaryDoctorPhone?.trim() || null,
    preferredPharmacy: input.preferredPharmacy?.trim() || null,

    currentCarrierId: input.currentCarrierId || null,
    currentPlanName: input.currentPlanName?.trim() || null,
    currentPlanType: input.currentPlanType || null,
    offeredCarrierId: input.offeredCarrierId || null,
    offeredPlanName: input.offeredPlanName?.trim() || null,
    offeredPlanType: input.offeredPlanType || null,
    changeReason: input.changeReason?.trim() || null,
    electionPeriod: input.electionPeriod?.trim() || null,
    presentationMethod: input.presentationMethod || null,

    soaSigned: input.soaSigned,
    soaDate: input.soaDate ? new Date(input.soaDate) : null,
    soaMethod: input.soaMethod?.trim() || null,
    callRecordingUrl: input.callRecordingUrl?.trim() || null,

    effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
    confirmationNumber: input.confirmationNumber?.trim() || null,

    poa: input.poa,
    poaFirstName: input.poaFirstName?.trim() || null,
    poaLastName: input.poaLastName?.trim() || null,
    poaAddress: input.poaAddress?.trim() || null,
    poaPhone: input.poaPhone?.trim() || null,
    poaRelationship: input.poaRelationship?.trim() || null,

    currentAor: input.currentAor,
    currentAorName: input.currentAorName?.trim() || null,
    acceptsAgentChange: input.acceptsAgentChange,
    acceptsPlanChange: input.acceptsPlanChange,
    signatureUrl: input.signatureUrl?.trim() || null,
  };

  const conditions = input.conditions.filter((c) => c.name.trim());
  const medications = input.medications.filter((m) => m.name.trim());
  const specialists = input.specialists.filter((s) => s.name.trim());

  await prisma.$transaction(async (tx) => {
    const profile = await tx.medicareProfile.upsert({
      where: { clientId },
      update: data,
      create: { clientId, ...data },
    });

    await tx.medicareCondition.deleteMany({ where: { medicareProfileId: profile.id } });
    if (conditions.length) {
      await tx.medicareCondition.createMany({
        data: conditions.map((c) => ({
          medicareProfileId: profile.id,
          name: c.name.trim(),
          isChronic: c.isChronic,
        })),
      });
    }

    await tx.medicareMedication.deleteMany({ where: { medicareProfileId: profile.id } });
    if (medications.length) {
      await tx.medicareMedication.createMany({
        data: medications.map((m) => ({
          medicareProfileId: profile.id,
          name: m.name.trim(),
          mg: m.mg?.trim() || null,
          frequency: m.frequency?.trim() || null,
        })),
      });
    }

    await tx.medicareSpecialist.deleteMany({ where: { medicareProfileId: profile.id } });
    if (specialists.length) {
      await tx.medicareSpecialist.createMany({
        data: specialists.map((s) => ({
          medicareProfileId: profile.id,
          name: s.name.trim(),
          address: s.address?.trim() || null,
          phone: s.phone?.trim() || null,
          nextAppointmentAt: s.nextAppointmentAt ? new Date(s.nextAppointmentAt) : null,
        })),
      });
    }
  });

  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}
