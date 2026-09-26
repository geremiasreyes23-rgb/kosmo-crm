"use server";

import { prisma } from "@/lib/db";
import { requireUser, canViewAll } from "@/lib/auth";
import { formatClientCode } from "@/lib/utils";

export interface GlobalSearchHit {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
}

export interface GlobalSearchResult {
  clients: GlobalSearchHit[];
  leads: GlobalSearchHit[];
  policies: GlobalSearchHit[];
  carriers: GlobalSearchHit[];
}

const EMPTY_RESULT: GlobalSearchResult = { clients: [], leads: [], policies: [], carriers: [] };

const RESULTS_PER_GROUP = 5;

/** Buscador global del header ("Buscar cliente, lead, póliza, carrier...")
 * — respeta el mismo alcance por rol que el resto del CRM: sin
 * "*:view_all", un vendedor solo encuentra sus propios clientes/leads/
 * pólizas (los carriers son catálogo compartido, visibles para todos). El
 * ID visible del cliente (Client.clientNumber, ver formatClientCode) es
 * buscable igual que el nombre/teléfono/email. */
export async function globalSearchAction(rawQuery: string): Promise<GlobalSearchResult> {
  const user = await requireUser();
  const query = rawQuery.trim();
  if (query.length < 2) return EMPTY_RESULT;

  const viewAll = canViewAll(user);
  const scope = user.agentId ?? "__sin-agente__";

  // Permite buscar el ID de cliente escribiendo "C-000123", "000123" o
  // "123" — se compara tanto contra el texto formateado como, si la
  // consulta es numérica, contra el número crudo.
  const asNumber = /^\d+$/.test(query.replace(/^c-?/i, "")) ? Number(query.replace(/^c-?/i, "")) : null;

  const [clientRows, leadRows, policyRows, carrierRows] = await Promise.all([
    prisma.client.findMany({
      where: {
        ...(viewAll ? {} : { agentId: scope }),
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          ...(asNumber != null ? [{ clientNumber: asNumber }] : []),
        ],
      },
      select: { id: true, firstName: true, lastName: true, clientNumber: true, phone: true, email: true },
      take: RESULTS_PER_GROUP,
      orderBy: { createdAt: "desc" },
    }),
    prisma.lead.findMany({
      where: {
        ...(viewAll ? {} : { agentId: scope }),
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      take: RESULTS_PER_GROUP,
      orderBy: { createdAt: "desc" },
    }),
    prisma.policy.findMany({
      where: {
        ...(viewAll ? {} : { agentId: scope }),
        OR: [
          { policyNumber: { contains: query, mode: "insensitive" } },
          { client: { firstName: { contains: query, mode: "insensitive" } } },
          { client: { lastName: { contains: query, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        policyNumber: true,
        clientId: true,
        client: { select: { firstName: true, lastName: true } },
      },
      take: RESULTS_PER_GROUP,
      orderBy: { createdAt: "desc" },
    }),
    prisma.carrier.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      select: { id: true, name: true },
      take: RESULTS_PER_GROUP,
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    clients: clientRows.map((c) => ({
      id: c.id,
      label: `${c.firstName} ${c.lastName}`,
      sublabel: `${formatClientCode(c.clientNumber)}${c.phone ? ` · ${c.phone}` : c.email ? ` · ${c.email}` : ""}`,
      href: `/clients/${c.id}`,
    })),
    leads: leadRows.map((l) => ({
      id: l.id,
      label: `${l.firstName} ${l.lastName}`,
      sublabel: l.phone ?? l.email ?? undefined,
      href: `/leads/${l.id}`,
    })),
    policies: policyRows.map((p) => ({
      id: p.id,
      label: p.policyNumber ?? "Sin número",
      sublabel: `${p.client.firstName} ${p.client.lastName}`,
      href: `/clients/${p.clientId}`,
    })),
    carriers: carrierRows.map((c) => ({
      id: c.id,
      label: c.name,
      href: `/policies`,
    })),
  };
}
