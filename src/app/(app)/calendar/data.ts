import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import type { AppointmentItem } from "@/types";

const appointmentInclude = {
  user: true,
  lead: { select: { firstName: true, lastName: true } },
  client: { select: { firstName: true, lastName: true } },
} satisfies Prisma.AppointmentInclude;

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

function mapAppointment(row: AppointmentRow): AppointmentItem {
  const relatedTo = row.lead
    ? `${row.lead.firstName} ${row.lead.lastName}`
    : row.client
      ? `${row.client.firstName} ${row.client.lastName}`
      : "—";
  return {
    id: row.id,
    title: row.title,
    relatedTo,
    relatedLeadId: row.leadId ?? undefined,
    relatedClientId: row.clientId ?? undefined,
    startsAt: row.startsAt.toISOString(),
    durationMinutes: row.durationMinutes,
    status: row.status,
  };
}

/** Alcance: sin "*:view_all", un vendedor ve las citas que agendó él mismo,
 * o las ligadas a un lead/cliente suyo. */
export async function getAppointmentsForUser(
  user: SessionUser,
  filter?: { clientId?: string; leadId?: string }
): Promise<AppointmentItem[]> {
  const rbacWhere: Prisma.AppointmentWhereInput | undefined = canViewAll(user)
    ? undefined
    : {
        OR: [
          { userId: user.id },
          { lead: { agentId: user.agentId ?? "__sin-agente__" } },
          { client: { agentId: user.agentId ?? "__sin-agente__" } },
        ],
      };

  const where: Prisma.AppointmentWhereInput = {
    ...(rbacWhere ?? {}),
    ...(filter?.clientId ? { clientId: filter.clientId } : {}),
    ...(filter?.leadId ? { leadId: filter.leadId } : {}),
  };

  const rows = await prisma.appointment.findMany({
    where,
    include: appointmentInclude,
    orderBy: { startsAt: "asc" },
  });
  return rows.map(mapAppointment);
}
