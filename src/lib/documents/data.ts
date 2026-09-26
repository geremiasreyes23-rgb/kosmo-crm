import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import type { DocumentVM } from "@/types";

const documentInclude = {
  uploadedBy: { select: { firstName: true, lastName: true } },
  // Solo lo necesario para mostrar "a qué está ligado" en el módulo
  // standalone /documents (ver relatedInfo más abajo) — las pantallas que
  // ya mostraban documentos como tab (Cliente/Lead) no usan estos campos,
  // así que no cambia nada para ellas.
  lead: { select: { id: true, firstName: true, lastName: true } },
  client: { select: { id: true, firstName: true, lastName: true } },
  sale: { select: { id: true, planName: true, client: { select: { id: true, firstName: true, lastName: true } } } },
  policy: { select: { id: true, policyNumber: true, client: { select: { id: true, firstName: true, lastName: true } } } },
} satisfies Prisma.DocumentInclude;

type DocumentRow = Prisma.DocumentGetPayload<{ include: typeof documentInclude }>;

/** A qué registro está ligado un documento — un documento siempre pertenece
 * a exactamente uno de los cuatro (ver schema.prisma), así que basta
 * revisarlos en orden. Para Venta/Póliza, que hoy no tienen página de
 * detalle propia, se enlaza al cliente relacionado cuando existe. */
function relatedInfo(
  row: DocumentRow
): { type: "Lead" | "Client" | "Sale" | "Policy"; label: string; href: string } | undefined {
  if (row.client) {
    return { type: "Client", label: `${row.client.firstName} ${row.client.lastName}`, href: `/clients/${row.client.id}` };
  }
  if (row.lead) {
    return { type: "Lead", label: `${row.lead.firstName} ${row.lead.lastName}`, href: `/leads/${row.lead.id}` };
  }
  if (row.sale) {
    const clientLabel = row.sale.client ? `${row.sale.client.firstName} ${row.sale.client.lastName}` : null;
    return {
      type: "Sale",
      label: clientLabel ? `Venta — ${clientLabel}` : row.sale.planName ? `Venta — ${row.sale.planName}` : "Venta",
      href: row.sale.client ? `/clients/${row.sale.client.id}` : "/sales",
    };
  }
  if (row.policy) {
    const clientLabel = `${row.policy.client.firstName} ${row.policy.client.lastName}`;
    return {
      type: "Policy",
      label: row.policy.policyNumber ? `Póliza ${row.policy.policyNumber} — ${clientLabel}` : `Póliza — ${clientLabel}`,
      href: `/clients/${row.policy.client.id}`,
    };
  }
  return undefined;
}

function mapDocument(row: DocumentRow): DocumentVM {
  const related = relatedInfo(row);
  return {
    id: row.id,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    category: row.category ?? undefined,
    uploadedByName: `${row.uploadedBy.firstName} ${row.uploadedBy.lastName}`,
    uploadedAt: row.uploadedAt.toISOString(),
    leadId: row.leadId ?? undefined,
    clientId: row.clientId ?? undefined,
    saleId: row.saleId ?? undefined,
    policyId: row.policyId ?? undefined,
    relatedType: related?.type,
    relatedLabel: related?.label,
    relatedHref: related?.href,
  };
}

/** Documentos ligados a un lead, cliente, venta o póliza — mismo alcance por
 * rol que Notas: sin "*:view_all", un vendedor solo ve documentos de sus
 * propios registros. */
export async function getDocumentsForUser(
  user: SessionUser,
  filter: { clientId?: string; leadId?: string; saleId?: string; policyId?: string } = {}
): Promise<DocumentVM[]> {
  const viewAll = canViewAll(user);
  const scope = user.agentId ?? "__sin-agente__";

  const where: Prisma.DocumentWhereInput = {
    ...(filter.clientId ? { clientId: filter.clientId } : {}),
    ...(filter.leadId ? { leadId: filter.leadId } : {}),
    ...(filter.saleId ? { saleId: filter.saleId } : {}),
    ...(filter.policyId ? { policyId: filter.policyId } : {}),
    ...(viewAll
      ? {}
      : {
          OR: [
            { client: { agentId: scope } },
            { lead: { agentId: scope } },
            { sale: { agentId: scope } },
            { policy: { agentId: scope } },
          ],
        }),
  };

  const rows = await prisma.document.findMany({ where, include: documentInclude, orderBy: { uploadedAt: "desc" } });
  return rows.map(mapDocument);
}
