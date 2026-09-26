"use server";

import type { TimeEntry } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Fichaje / cronómetro personal — "Iniciar" abre una jornada (TimeEntry),
 * "Pausar"/"Reanudar" alternan sin contar el tiempo de pausa como trabajado,
 * y "Finalizar" la cierra. Todo queda en base de datos (no solo en memoria
 * del navegador) para que sobreviva a un refresh o a cerrar el navegador.
 */

export interface TimeEntryPayload {
  id: string;
  status: "WORKING" | "PAUSED" | "FINISHED";
  clockIn: string;
  pausedAt: string | null;
  totalPausedSeconds: number;
}

function serialize(entry: TimeEntry): TimeEntryPayload {
  return {
    id: entry.id,
    status: entry.status,
    clockIn: entry.clockIn.toISOString(),
    pausedAt: entry.pausedAt ? entry.pausedAt.toISOString() : null,
    totalPausedSeconds: entry.totalPausedSeconds,
  };
}

async function getOwnedActiveEntry(entryId: string, userId: string) {
  const entry = await prisma.timeEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) return null;
  return entry;
}

export async function clockInAction(): Promise<
  { ok: true; entry: TimeEntryPayload } | { ok: false; error: string }
> {
  const user = await requireUser();

  // Idempotente: si ya hay una jornada abierta, la devolvemos en vez de
  // crear una segunda (por ejemplo si el usuario dio doble clic).
  const existing = await prisma.timeEntry.findFirst({
    where: { userId: user.id, status: { in: ["WORKING", "PAUSED"] } },
    orderBy: { clockIn: "desc" },
  });
  if (existing) return { ok: true, entry: serialize(existing) };

  const entry = await prisma.timeEntry.create({ data: { userId: user.id } });
  return { ok: true, entry: serialize(entry) };
}

export async function pauseAction(
  entryId: string
): Promise<{ ok: true; entry: TimeEntryPayload } | { ok: false; error: string }> {
  const user = await requireUser();
  const entry = await getOwnedActiveEntry(entryId, user.id);
  if (!entry) return { ok: false, error: "No se encontró la jornada." };
  if (entry.status !== "WORKING") return { ok: false, error: "La jornada no está activa." };

  const updated = await prisma.timeEntry.update({
    where: { id: entryId },
    data: { status: "PAUSED", pausedAt: new Date() },
  });
  return { ok: true, entry: serialize(updated) };
}

export async function resumeAction(
  entryId: string
): Promise<{ ok: true; entry: TimeEntryPayload } | { ok: false; error: string }> {
  const user = await requireUser();
  const entry = await getOwnedActiveEntry(entryId, user.id);
  if (!entry) return { ok: false, error: "No se encontró la jornada." };
  if (entry.status !== "PAUSED" || !entry.pausedAt) {
    return { ok: false, error: "La jornada no está en pausa." };
  }

  const pausedSeconds = Math.max(0, Math.floor((Date.now() - entry.pausedAt.getTime()) / 1000));
  const updated = await prisma.timeEntry.update({
    where: { id: entryId },
    data: {
      status: "WORKING",
      pausedAt: null,
      totalPausedSeconds: entry.totalPausedSeconds + pausedSeconds,
    },
  });
  return { ok: true, entry: serialize(updated) };
}

export async function finishAction(
  entryId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const entry = await getOwnedActiveEntry(entryId, user.id);
  if (!entry) return { ok: false, error: "No se encontró la jornada." };
  if (entry.status === "FINISHED") return { ok: false, error: "La jornada ya estaba finalizada." };

  let totalPausedSeconds = entry.totalPausedSeconds;
  if (entry.status === "PAUSED" && entry.pausedAt) {
    totalPausedSeconds += Math.max(0, Math.floor((Date.now() - entry.pausedAt.getTime()) / 1000));
  }

  await prisma.timeEntry.update({
    where: { id: entryId },
    data: { status: "FINISHED", clockOut: new Date(), pausedAt: null, totalPausedSeconds },
  });
  return { ok: true };
}
