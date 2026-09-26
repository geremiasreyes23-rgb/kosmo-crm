import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import type { MedicareProfileVM } from "@/types";

const medicareProfileInclude = {
  conditions: true,
  medications: true,
  specialists: true,
} satisfies Prisma.MedicareProfileInclude;

type MedicareProfileRow = Prisma.MedicareProfileGetPayload<{ include: typeof medicareProfileInclude }>;

function mapMedicareProfile(row: MedicareProfileRow): MedicareProfileVM {
  return {
    hasMedicaid: row.hasMedicaid,
    dualClassification: row.dualClassification ?? undefined,
    qmb: row.qmb,
    fbde: row.fbde,
    slmb: row.slmb,
    extraHelp: row.extraHelp,

    healthRating: row.healthRating ?? undefined,
    weight: row.weight ?? undefined,
    height: row.height ?? undefined,
    homeAttendant: row.homeAttendant,
    homeAttendantCompany: row.homeAttendantCompany ?? undefined,
    hasCancer: row.hasCancer,
    onDialysis: row.onDialysis,

    primaryDoctorName: row.primaryDoctorName ?? undefined,
    primaryDoctorAddress: row.primaryDoctorAddress ?? undefined,
    primaryDoctorPhone: row.primaryDoctorPhone ?? undefined,
    preferredPharmacy: row.preferredPharmacy ?? undefined,

    currentCarrierId: row.currentCarrierId ?? undefined,
    currentPlanName: row.currentPlanName ?? undefined,
    currentPlanType: row.currentPlanType ?? undefined,
    offeredCarrierId: row.offeredCarrierId ?? undefined,
    offeredPlanName: row.offeredPlanName ?? undefined,
    offeredPlanType: row.offeredPlanType ?? undefined,
    changeReason: row.changeReason ?? undefined,
    electionPeriod: row.electionPeriod ?? undefined,
    presentationMethod: row.presentationMethod ?? undefined,

    soaSigned: row.soaSigned,
    soaDate: row.soaDate ? row.soaDate.toISOString().slice(0, 10) : undefined,
    soaMethod: row.soaMethod ?? undefined,
    callRecordingUrl: row.callRecordingUrl ?? undefined,

    effectiveDate: row.effectiveDate ? row.effectiveDate.toISOString().slice(0, 10) : undefined,
    confirmationNumber: row.confirmationNumber ?? undefined,

    poa: row.poa,
    poaFirstName: row.poaFirstName ?? undefined,
    poaLastName: row.poaLastName ?? undefined,
    poaAddress: row.poaAddress ?? undefined,
    poaPhone: row.poaPhone ?? undefined,
    poaRelationship: row.poaRelationship ?? undefined,

    currentAor: row.currentAor,
    currentAorName: row.currentAorName ?? undefined,
    acceptsAgentChange: row.acceptsAgentChange,
    acceptsPlanChange: row.acceptsPlanChange,
    signatureUrl: row.signatureUrl ?? undefined,

    conditions: row.conditions.map((c) => ({ id: c.id, name: c.name, isChronic: c.isChronic })),
    medications: row.medications.map((m) => ({
      id: m.id,
      name: m.name,
      mg: m.mg ?? undefined,
      frequency: m.frequency ?? undefined,
    })),
    specialists: row.specialists.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address ?? undefined,
      phone: s.phone ?? undefined,
      nextAppointmentAt: s.nextAppointmentAt ? s.nextAppointmentAt.toISOString().slice(0, 10) : undefined,
    })),
  };
}

/** Mismo control de alcance por rol que el resto del expediente del cliente
 * — null tanto si el cliente no existe/no tiene perfil como si el usuario no
 * tiene permiso de verlo. */
export async function getMedicareProfileForClient(
  clientId: string,
  user: SessionUser
): Promise<MedicareProfileVM | null> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return null;
  if (!canViewAll(user) && client.agentId !== user.agentId) return null;

  const row = await prisma.medicareProfile.findUnique({
    where: { clientId },
    include: medicareProfileInclude,
  });
  return row ? mapMedicareProfile(row) : null;
}


export interface MedicareFormOptions {
  carriers: { id: string; name: string }[];
}

/** Carriers activos que efectivamente ofrecen Medicare Advantage — mismo
 * catálogo sembrado en prisma/seed.ts (Carrier + CarrierInsuranceLine). */
export async function getMedicareFormOptions(): Promise<MedicareFormOptions> {
  const line = await prisma.insuranceLine.findUnique({ where: { code: "MEDICARE" } });
  const carriers = await prisma.carrier.findMany({
    where: { status: "ACTIVE", ...(line ? { lines: { some: { insuranceLineId: line.id } } } : {}) },
    orderBy: { name: "asc" },
  });
  return { carriers: carriers.map((c) => ({ id: c.id, name: c.name })) };
}
