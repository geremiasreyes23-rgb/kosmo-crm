import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import type { NoteVM } from "@/types";

function mapNote(row: { id: string; body: string; createdAt: Date; leadId: string | null; clientId: string | null; policyId: string | null }): NoteVM {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    leadId: row.leadId ?? undefined,
    clientId: row.clientId ?? undefined,
    policyId: row.policyId ?? undefined,
  };
}

/** Notas ligadas a un lead, cliente o póliza — mismo alcance por rol que el
 * resto del CRM: sin "*:view_all", un vendedor solo ve notas de sus propios
 * leads/clientes (o pólizas de sus propios clientes). */
export async function getNotesForUser(
  user: SessionUser,
  filter: { clientId?: string; leadId?: string; policyId?: string }
): Promise<NoteVM[]> {
  const viewAll = canViewAll(user);
  const scope = user.agentId ?? "__sin-agente__";

  const where: Prisma.NoteWhereInput = {
    ...(filter.clientId ? { clientId: filter.clientId } : {}),
    ...(filter.leadId ? { leadId: filter.leadId } : {}),
    ...(filter.policyId ? { policyId: filter.policyId } : {}),
    ...(viewAll
      ? {}
      : {
          OR: [
            { client: { agentId: scope } },
            { lead: { agentId: scope } },
            { policy: { agentId: scope } },
          ],
        }),
  };

  const rows = await prisma.note.findMany({ where, orderBy: { createdAt: "desc" } });
  return rows.map(mapNote);
}
