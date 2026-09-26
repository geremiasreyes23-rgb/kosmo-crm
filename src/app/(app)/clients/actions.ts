"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, canViewAll, hasPermission } from "@/lib/auth";
import { upsertSensitiveField, revealSensitiveField } from "@/lib/sensitiveData";

export interface ClientActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface CreateClientInput {
  firstName: string;
  lastName: string;
  dob?: string;
  phone?: string;
  email?: string;
  address?: string;
  zipCode?: string;
  county?: string;
  state?: string;
  preferredLanguage?: string;
  sourceId?: string;
  /** Ignorado si el usuario no tiene permiso de ver/asignar todo el negocio
   * — igual que en createLeadAction, el cliente siempre se asigna a sí
   * mismo en ese caso. */
  agentId?: string;
  aorId?: string;
}

export async function createClientAction(input: CreateClientInput): Promise<ClientActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "clients", "create")) {
    return { ok: false, error: "No tienes permiso para crear clientes." };
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    return { ok: false, error: "Nombre y apellido son obligatorios." };
  }

  const agentId = canViewAll(user) ? input.agentId || null : user.agentId;

  const client = await prisma.client.create({
    data: {
      firstName,
      lastName,
      dob: input.dob ? new Date(input.dob) : null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      zipCode: input.zipCode?.trim() || null,
      county: input.county?.trim() || null,
      state: input.state?.trim() || null,
      preferredLanguage: input.preferredLanguage?.trim() || null,
      sourceId: input.sourceId || null,
      agentId,
      aorId: canViewAll(user) ? input.aorId || null : null,
    },
  });

  revalidatePath("/clients");
  return { ok: true, id: client.id };
}

/** Verifica que el usuario pueda operar sobre este cliente (mismo dueño, o
 * alcance "ver todo") — null si no existe o no hay alcance, sin distinguir
 * cuál de los dos casos es. */
async function findOwnedClient(clientId: string, user: { agentId: string | null }, viewAll: boolean) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return null;
  if (!viewAll && client.agentId !== user.agentId) return null;
  return client;
}

/**
 * Crea o reemplaza el valor de un campo sensible (SSN, cuenta bancaria...)
 * de un cliente. A propósito requiere solo "clients:edit", no
 * "sensitive_data:view" — cualquiera que pueda editar la ficha del cliente
 * puede capturar un dato sensible nuevo (ej. tomar el SSN durante la
 * llamada de venta), pero volver a LEER el valor ya guardado más adelante
 * sí exige el permiso especial (ver revealSensitiveFieldAction, abajo).
 * Guardar y ver son permisos distintos a propósito.
 */
export async function setSensitiveFieldAction(
  clientId: string,
  fieldKey: string,
  value: string
): Promise<ClientActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "clients", "edit")) {
    return { ok: false, error: "No tienes permiso para editar clientes." };
  }

  const key = fieldKey.trim();
  const plainValue = value.trim();
  if (!key || !plainValue) {
    return { ok: false, error: "Selecciona el campo y escribe un valor." };
  }

  const client = await findOwnedClient(clientId, user, canViewAll(user));
  if (!client) {
    return { ok: false, error: "El cliente ya no existe o no tienes acceso." };
  }

  const field = await upsertSensitiveField(clientId, key, plainValue);

  revalidatePath(`/clients/${clientId}`);
  return { ok: true, id: field.id };
}

export interface RevealSensitiveFieldResult {
  ok: boolean;
  error?: string;
  label?: string;
  value?: string;
}

/**
 * Descifra y devuelve el valor real de un campo sensible — bajo demanda
 * únicamente (nunca se manda al cliente como parte de la carga inicial de
 * la página). Exige "sensitive_data:view" (por defecto, solo Super
 * Admin/Admin, ver prisma/seed.ts) y dueño del cliente (o alcance "ver
 * todo"), y siempre queda una fila en SensitiveDataAccessLog — ver
 * revealSensitiveField en src/lib/sensitiveData.ts.
 */
export async function revealSensitiveFieldAction(
  fieldId: string,
  reason?: string
): Promise<RevealSensitiveFieldResult> {
  const user = await requireUser();
  if (!hasPermission(user, "sensitive_data", "view")) {
    return { ok: false, error: "No tienes permiso para ver datos sensibles." };
  }

  const field = await prisma.sensitiveField.findUnique({
    where: { id: fieldId },
    include: { client: true },
  });
  if (!field) {
    return { ok: false, error: "El campo ya no existe." };
  }
  if (!canViewAll(user) && field.client.agentId !== user.agentId) {
    return { ok: false, error: "No puedes ver datos sensibles de clientes de otro vendedor." };
  }

  const result = await revealSensitiveField(fieldId, user.id, reason);
  if (!result) {
    return { ok: false, error: "El campo ya no existe." };
  }
  return { ok: true, label: result.label, value: result.value };
}
