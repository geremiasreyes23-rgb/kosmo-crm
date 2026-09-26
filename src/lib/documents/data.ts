import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import type { DocumentVM } from "@/types";

const documentInclude = {
  uploadedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.DocumentInclude;

type DocumentRow = Prisma.DocumentGetPayload<{ include: typeof documentInclude }>;

function mapDocument(row: DocumentRow): DocumentVM {
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
  };
}

/** Documentos ligados a un lead, cliente, venta o póliza — mismo alcance por
 * rol que Notas: sin "*:view_all", un vendedor solo ve documentos de sus
 * propios registros. */
export async function getDocumentsForUser(
  user: SessionUser,
  filter: { clientId?: string; leadId?: string; saleId?: string; policyId?: string }
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
