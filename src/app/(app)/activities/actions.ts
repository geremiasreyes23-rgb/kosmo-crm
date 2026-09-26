"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth";
import { assertRelatedOwnership } from "@/lib/relatedRecords";
import type { ActivityType } from "@prisma/client";

export interface ActivityActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface CreateActivityInput {
  type: ActivityType;
  notes?: string;
  relatedLeadId?: string;
  relatedClientId?: string;
}

/** Registra una actividad — siempre a nombre de quien la registra (userId =
 * sesión actual, nunca un selector): no tiene sentido dejar que alguien
 * registre una llamada "hecha por" otra persona. */
export async function createActivityAction(input: CreateActivityInput): Promise<ActivityActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "activities", "create")) {
    return { ok: false, error: "No tienes permiso para registrar actividades." };
  }

  const leadId = input.relatedLeadId || null;
  const clientId = input.relatedClientId || null;
  if (!leadId && !clientId) {
    return { ok: false, error: "Selecciona a qué lead o cliente está relacionada." };
  }

  const ownershipError = await assertRelatedOwnership(leadId, clientId, user);
  if (ownershipError) return { ok: false, error: ownershipError };

  const activity = await prisma.activity.create({
    data: {
      type: input.type,
      notes: input.notes?.trim() || null,
      userId: user.id,
      leadId,
      clientId,
    },
  });

  revalidatePath("/activities");
  return { ok: true, id: activity.id };
}
