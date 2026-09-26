import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import type { ActivityItem } from "@/types";

const activityInclude = {
  user: true,
  lead: { select: { firstName: true, lastName: true } },
  client: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ActivityInclude;

type ActivityRow = Prisma.ActivityGetPayload<{ include: typeof activityInclude }>;

function mapActivity(row: ActivityRow): ActivityItem {
  const relatedTo = row.lead
    ? `${row.lead.firstName} ${row.lead.lastName}`
    : row.client
      ? `${row.client.firstName} ${row.client.lastName}`
      : "—";
  return {
    id: row.id,
    type: row.type as ActivityItem["type"],
    relatedTo,
    relatedLeadId: row.leadId ?? undefined,
    relatedClientId: row.clientId ?? undefined,
    user: `${row.user.firstName} ${row.user.lastName}`,
    occurredAt: row.occurredAt.toISOString(),
    notes: row.notes ?? undefined,
  };
}

/** Alcance: sin "*:view_all", un vendedor ve las actividades que registró
 * él mismo, o las que están ligadas a un lead/cliente suyo (aunque las haya
 * registrado otra persona, ej. un manager cubriendo su cartera). */
export async function getActivitiesForUser(
  user: SessionUser,
  filter?: { clientId?: string; leadId?: string }
): Promise<ActivityItem[]> {
  const rbacWhere: Prisma.ActivityWhereInput | undefined = canViewAll(user)
    ? undefined
    : {
        OR: [
          { userId: user.id },
          { lead: { agentId: user.agentId ?? "__sin-agente__" } },
          { client: { agentId: user.agentId ?? "__sin-agente__" } },
        ],
      };

  // Combinar el alcance por rol con un filtro puntual (ficha de un lead o
  // cliente específico) — al ser claves distintas en el mismo objeto,
  // Prisma las combina con AND: "cumple el alcance del rol Y pertenece a
  // este lead/cliente".
  const where: Prisma.ActivityWhereInput = {
    ...(rbacWhere ?? {}),
    ...(filter?.clientId ? { clientId: filter.clientId } : {}),
    ...(filter?.leadId ? { leadId: filter.leadId } : {}),
  };

  const rows = await prisma.activity.findMany({
    where,
    include: activityInclude,
    orderBy: { occurredAt: "desc" },
    take: filter ? 50 : 200,
  });
  return rows.map(mapActivity);
}
