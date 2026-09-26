"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth";
import { assertRelatedOwnership } from "@/lib/relatedRecords";

export interface NoteActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface CreateNoteInput {
  body: string;
  relatedLeadId?: string;
  relatedClientId?: string;
}

/** Crea una nota libre ligada a un lead o cliente (sección 12 del brief de
 * arquitectura) — reutiliza el mismo control de pertenencia que Actividades/
 * Tareas/Citas (src/lib/relatedRecords.ts), y el permiso de edición de la
 * entidad a la que se liga (no existe un recurso "notes" propio en el
 * catálogo de permisos: una nota es parte del expediente del lead/cliente). */
export async function createNoteAction(input: CreateNoteInput): Promise<NoteActionResult> {
  const user = await requireUser();

  const body = input.body.trim();
  if (!body) return { ok: false, error: "La nota no puede estar vacía." };

  const leadId = input.relatedLeadId || null;
  const clientId = input.relatedClientId || null;
  if (!leadId && !clientId) {
    return { ok: false, error: "Selecciona a qué lead o cliente pertenece la nota." };
  }
  if (!hasPermission(user, leadId ? "leads" : "clients", "edit")) {
    return { ok: false, error: "No tienes permiso para agregar notas aquí." };
  }

  const ownershipError = await assertRelatedOwnership(leadId, clientId, user);
  if (ownershipError) return { ok: false, error: ownershipError };

  const note = await prisma.note.create({ data: { body, leadId, clientId } });

  if (leadId) revalidatePath(`/leads/${leadId}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
  return { ok: true, id: note.id };
}
