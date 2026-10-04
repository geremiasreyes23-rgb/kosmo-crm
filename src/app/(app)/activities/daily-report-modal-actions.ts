"use server";

import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth";
import { createDailyReportAction } from "./reports-actions";

/**
 * Acciones del modal "Reporte diario" (recordatorio automático + acceso
 * manual desde el reloj de la tarjeta de jornada). El envío reutiliza
 * createDailyReportAction — misma validación, mismo aviso a supervisores —
 * así que un reporte enviado desde el modal es idéntico a uno creado desde
 * Actividades → Reportes diarios.
 *
 * `day` es la fecha LOCAL del usuario (YYYY-MM-DD) y `dayStartIso` el inicio
 * de ese día en su zona horaria: el servidor no conoce la zona del usuario.
 */

const MAX_CONTENT_LENGTH = 2000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface DailyReportModalState {
  enabled: boolean;
  draft: string;
  sentToday: boolean;
}

function validDayStart(iso: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Margen de ±36 h respecto de ahora: nunca se consulta un día arbitrario.
  return Math.abs(Date.now() - d.getTime()) <= 36 * 3600_000 ? d : null;
}

export async function getDailyReportModalStateAction(day: string, dayStartIso: string): Promise<DailyReportModalState> {
  const user = await requireUser();
  if (!hasPermission(user, "activities", "create") || !DAY_RE.test(day)) {
    return { enabled: false, draft: "", sentToday: false };
  }
  const dayStart = validDayStart(dayStartIso);
  const [draft, sent] = await Promise.all([
    prisma.dailyReportDraft.findUnique({ where: { userId_day: { userId: user.id, day } }, select: { content: true } }),
    dayStart
      ? prisma.dailyReport.findFirst({ where: { userId: user.id, createdAt: { gte: dayStart } }, select: { id: true } })
      : null,
  ]);
  return { enabled: true, draft: draft?.content ?? "", sentToday: !!sent };
}

export async function saveDailyReportDraftAction(day: string, content: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!hasPermission(user, "activities", "create")) {
    return { ok: false, error: "No tienes permiso para registrar reportes diarios." };
  }
  if (!DAY_RE.test(day)) return { ok: false, error: "Fecha inválida." };
  const text = content.slice(0, MAX_CONTENT_LENGTH);
  if (!text.trim()) {
    await prisma.dailyReportDraft.deleteMany({ where: { userId: user.id, day } });
    return { ok: true };
  }
  await prisma.dailyReportDraft.upsert({
    where: { userId_day: { userId: user.id, day } },
    update: { content: text },
    create: { userId: user.id, day, content: text },
  });
  return { ok: true };
}

export async function submitDailyReportFromModalAction(
  day: string,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await createDailyReportAction(content);
  if (!result.ok) return { ok: false, error: result.error };
  if (DAY_RE.test(day)) {
    const user = await requireUser();
    await prisma.dailyReportDraft.deleteMany({ where: { userId: user.id, day } });
  }
  return { ok: true };
}
