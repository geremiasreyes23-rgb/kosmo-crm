"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";

export interface DailyReportActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const MAX_CONTENT_LENGTH = 2000;

/** Crea el reporte diario a nombre de quien está en sesión — fecha, hora y
 * usuario los pone el servidor siempre (Date.now()/session), nunca vienen
 * del cliente, para que nadie pueda "adelantar" o "atrasar" su reporte. */
export async function createDailyReportAction(content: string): Promise<DailyReportActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "activities", "create")) {
    return { ok: false, error: "No tienes permiso para registrar reportes diarios." };
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, error: "Escribe el contenido de tu reporte antes de guardarlo." };
  }
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return { ok: false, error: `El reporte no puede superar ${MAX_CONTENT_LENGTH} caracteres.` };
  }

  const report = await prisma.dailyReport.create({
    data: {
      userId: user.id,
      content: trimmed,
      status: "PENDING",
    },
  });

  // Avisa a quienes pueden revisar reportes (permiso dedicado
  // "activities:review" — Manager/Admin/Super Admin, ver seed.ts) a través
  // del sistema global de notificaciones ya existente (campanita + toast),
  // sin inventar un canal aparte.
  const reviewers = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      id: { not: user.id },
      role: {
        permissions: {
          some: { permission: { resource: "activities", action: "review" } },
        },
      },
    },
    select: { id: true },
  });

  await Promise.all(
    reviewers.map((reviewer) =>
      notifyUser({
        userId: reviewer.id,
        type: "daily_report_submitted",
        title: "Nuevo reporte diario",
        message: `${user.firstName} ${user.lastName} envió su reporte del día.`,
        relatedEntityType: "DailyReport",
        relatedEntityId: report.id,
      })
    )
  );

  revalidatePath("/activities");
  return { ok: true, id: report.id };
}

/** Aprueba o rechaza un reporte ajeno. Quien lo redactó jamás puede cambiar
 * el estado de su propio reporte, aunque tenga permiso de revisión (ej. un
 * Admin que también registra su día) — regla explícita del brief. */
export async function reviewDailyReportAction(
  reportId: string,
  status: "APPROVED" | "REJECTED",
  reviewComment?: string
): Promise<DailyReportActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "activities", "review")) {
    return { ok: false, error: "No tienes permiso para revisar reportes diarios." };
  }

  const report = await prisma.dailyReport.findUnique({ where: { id: reportId } });
  if (!report) {
    return { ok: false, error: "El reporte no existe." };
  }
  if (report.userId === user.id) {
    return { ok: false, error: "No puedes revisar tu propio reporte." };
  }
  if (report.status !== "PENDING") {
    return { ok: false, error: "Este reporte ya fue revisado." };
  }

  const trimmedComment = reviewComment?.trim() || null;

  // Fase 15 (auditoría de seguridad) — el check "status !== PENDING" de
  // arriba no es atómico con este update: dos supervisores revisando el
  // mismo reporte casi al mismo tiempo podían pasarlo ambos y pisarse la
  // decisión (y disparar dos notificaciones contradictorias). El
  // updateMany condicional solo aplica si SIGUE en PENDING en ese instante;
  // si otro ya lo revisó, count queda en 0 y se corta acá sin notificar.
  const claimed = await prisma.dailyReport.updateMany({
    where: { id: reportId, status: "PENDING" },
    data: {
      status,
      reviewedById: user.id,
      reviewedAt: new Date(),
      reviewComment: trimmedComment,
    },
  });
  if (claimed.count === 0) {
    return { ok: false, error: "Este reporte ya fue revisado por otra persona." };
  }

  await notifyUser({
    userId: report.userId,
    type: "daily_report_reviewed",
    title: status === "APPROVED" ? "Reporte aprobado" : "Reporte rechazado",
    message:
      status === "APPROVED"
        ? `${user.firstName} ${user.lastName} aprobó tu reporte diario.`
        : `${user.firstName} ${user.lastName} rechazó tu reporte diario.${trimmedComment ? " Revisa el motivo." : ""}`,
    relatedEntityType: "DailyReport",
    relatedEntityId: report.id,
  });

  revalidatePath("/activities");
  return { ok: true, id: report.id };
}
