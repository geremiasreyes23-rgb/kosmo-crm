import "server-only";

import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";

/**
 * Fase 5 (Actividades + Tareas + Calendario) — las tres entidades se pueden
 * ligar opcionalmente a un Lead O a un Client (nunca ambos, ver
 * prisma/schema.prisma sección 12). Este archivo centraliza lo que las tres
 * comparten: el catálogo de "a qué se puede ligar" para el selector, y la
 * verificación de que ese lead/cliente sea del vendedor (o alcance "ver
 * todo") antes de dejar crear/editar algo contra él — mismo patrón de
 * alcance que ya usan leads/data.ts y clients/data.ts, solo que acá aplica
 * a los dos catálogos a la vez.
 */

export interface RelatedEntityOption {
  id: string;
  label: string;
}

export interface RelatedEntityOptions {
  leads: RelatedEntityOption[];
  clients: RelatedEntityOption[];
}

export async function getRelatedEntityOptions(user: SessionUser): Promise<RelatedEntityOptions> {
  const viewAll = canViewAll(user);
  const scope = viewAll ? undefined : { agentId: user.agentId ?? "__sin-agente__" };

  const [leads, clients] = await Promise.all([
    prisma.lead.findMany({
      where: scope,
      select: { id: true, firstName: true, lastName: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: scope,
      select: { id: true, firstName: true, lastName: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    leads: leads.map((l) => ({ id: l.id, label: `${l.firstName} ${l.lastName}` })),
    clients: clients.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}` })),
  };
}

/** Verifica que el lead/cliente elegido exista y sea del vendedor (salvo
 * alcance "ver todo") — devuelve un mensaje de error listo para mostrar, o
 * null si todo está en orden. A propósito nunca deja pasar los dos a la vez
 * (leadId Y clientId juntos): cada actividad/tarea/cita se liga a una sola
 * entidad, igual que el schema lo modela. */
export async function assertRelatedOwnership(
  leadId: string | null,
  clientId: string | null,
  user: SessionUser
): Promise<string | null> {
  if (leadId && clientId) {
    return "Solo se puede vincular a un lead o a un cliente, no a los dos.";
  }
  const viewAll = canViewAll(user);

  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return "El lead seleccionado ya no existe.";
    if (!viewAll && lead.agentId !== user.agentId) return "No puedes usar un lead de otro vendedor.";
  }
  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return "El cliente seleccionado ya no existe.";
    if (!viewAll && client.agentId !== user.agentId) return "No puedes usar un cliente de otro vendedor.";
  }
  return null;
}
