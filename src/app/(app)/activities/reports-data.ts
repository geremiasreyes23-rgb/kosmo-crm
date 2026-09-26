import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, hasPermission, type SessionUser } from "@/lib/auth";
import type { DailyReportVM } from "@/types";

const dailyReportInclude = {
  user: true,
  reviewedBy: true,
} satisfies Prisma.DailyReportInclude;

type DailyReportRow = Prisma.DailyReportGetPayload<{ include: typeof dailyReportInclude }>;

function mapDailyReport(row: DailyReportRow): DailyReportVM {
  return {
    id: row.id,
    userId: row.userId,
    userName: `${row.user.firstName} ${row.user.lastName}`,
    userAvatarUrl: row.user.avatarUrl ?? undefined,
    content: row.content,
    status: row.status,
    reviewedById: row.reviewedById ?? undefined,
    reviewedByName: row.reviewedBy ? `${row.reviewedBy.firstName} ${row.reviewedBy.lastName}` : undefined,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : undefined,
    reviewComment: row.reviewComment ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Alcance: sin "*:view_all", cada quien ve únicamente los reportes que
 * escribió (nunca los de otros compañeros) — igual convención de RBAC que
 * el resto del CRM. Se trae un lote generoso (los filtros de fecha del
 * historial se aplican en el cliente, ver DailyReportsView) para que "Los
 * últimos 5 días" sea solo la vista por defecto y nunca implique borrar ni
 * dejar fuera de alcance los reportes más antiguos. */
export async function getDailyReportsForUser(user: SessionUser): Promise<DailyReportVM[]> {
  const rows = await prisma.dailyReport.findMany({
    where: canViewAll(user) ? undefined : { userId: user.id },
    include: dailyReportInclude,
    orderBy: { createdAt: "desc" },
    take: 400,
  });
  return rows.map(mapDailyReport);
}

/** true si este usuario puede aprobar/rechazar reportes ajenos (permiso
 * dedicado "activities:review" — separado de "activities:create/edit" que
 * ya tiene Agente/Manager para registrar su propio reporte, ver seed.ts). */
export function canReviewDailyReports(user: SessionUser): boolean {
  return hasPermission(user, "activities", "review");
}
