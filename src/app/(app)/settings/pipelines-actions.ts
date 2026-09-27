"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { PipelineEntity } from "@prisma/client";

/**
 * Configuración → Pipelines y etapas. Antes esta pestaña era un solo
 * párrafo de texto fijo ("Administra las etapas..." sin nada abajo que
 * realmente lo permitiera) — los modelos Pipeline/PipelineStage ya existían
 * desde la Fase 1 (arquitectura-fase1.md sección 4) y ya se usan de verdad
 * en el Kanban de Leads y Ventas (ver leads/data.ts, sales/data.ts), pero
 * nunca hubo una pantalla para editarlos: las etapas quedaron fijas en lo
 * que sembró prisma/seed.ts. Este archivo agrega las acciones reales.
 */

const MANAGER_ROLES = ["Super Admin", "Admin"];

async function requirePipelineManager() {
  const current = await requireUser();
  if (!MANAGER_ROLES.includes(current.roleName)) {
    return { current: null, error: "No tienes permiso para editar pipelines y etapas." };
  }
  return { current, error: null };
}

export interface PipelineActionResult {
  ok: boolean;
  error?: string;
}

export async function createStageAction(input: {
  pipelineId: string;
  name: string;
}): Promise<PipelineActionResult> {
  const { current, error } = await requirePipelineManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre de la etapa no puede estar vacío." };

  const pipeline = await prisma.pipeline.findUnique({ where: { id: input.pipelineId } });
  if (!pipeline) return { ok: false, error: "Pipeline no encontrado." };

  const last = await prisma.pipelineStage.findFirst({
    where: { pipelineId: input.pipelineId },
    orderBy: { order: "desc" },
  });
  const nextOrder = (last?.order ?? 0) + 1;

  const stage = await prisma.pipelineStage.create({
    data: { pipelineId: input.pipelineId, name, order: nextOrder, isWon: false, isLost: false },
  });

  await logAudit({
    userId: current.id,
    action: "CREATE",
    entityType: "PipelineStage",
    entityId: stage.id,
    fieldName: "name",
    newValue: name,
  });

  revalidatePath("/settings");
  revalidatePath("/leads");
  revalidatePath("/sales");
  return { ok: true };
}

export async function renameStageAction(input: {
  stageId: string;
  name: string;
}): Promise<PipelineActionResult> {
  const { current, error } = await requirePipelineManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre de la etapa no puede estar vacío." };

  const stage = await prisma.pipelineStage.findUnique({ where: { id: input.stageId } });
  if (!stage) return { ok: false, error: "Etapa no encontrada." };

  await prisma.pipelineStage.update({ where: { id: input.stageId }, data: { name } });

  await logAudit({
    userId: current.id,
    action: "UPDATE",
    entityType: "PipelineStage",
    entityId: input.stageId,
    fieldName: "name",
    oldValue: stage.name,
    newValue: name,
  });

  revalidatePath("/settings");
  revalidatePath("/leads");
  revalidatePath("/sales");
  return { ok: true };
}

/**
 * "Ganada" y "perdida" son mutuamente excluyentes (una etapa no puede ser
 * las dos) — ver PipelineStage.isWon/isLost en el schema, que la lógica de
 * negocio usa para disparar automatizaciones (crear póliza al llegar a una
 * etapa "ganada", ver arquitectura-fase1.md sección 6.C). Guardar las dos
 * en true al mismo tiempo dejaría esa automatización en un estado
 * ambiguo, así que esta acción apaga la otra bandera automáticamente en
 * vez de confiar en que la UI nunca mande las dos juntas.
 */
export async function setStageFlagAction(input: {
  stageId: string;
  flag: "isWon" | "isLost";
  value: boolean;
}): Promise<PipelineActionResult> {
  const { current, error } = await requirePipelineManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const stage = await prisma.pipelineStage.findUnique({ where: { id: input.stageId } });
  if (!stage) return { ok: false, error: "Etapa no encontrada." };

  const other = input.flag === "isWon" ? "isLost" : "isWon";
  await prisma.pipelineStage.update({
    where: { id: input.stageId },
    data: { [input.flag]: input.value, ...(input.value ? { [other]: false } : {}) },
  });

  await logAudit({
    userId: current.id,
    action: "UPDATE",
    entityType: "PipelineStage",
    entityId: input.stageId,
    fieldName: input.flag,
    oldValue: String(stage[input.flag]),
    newValue: String(input.value),
  });

  revalidatePath("/settings");
  revalidatePath("/leads");
  revalidatePath("/sales");
  return { ok: true };
}

export async function moveStageAction(input: {
  stageId: string;
  direction: "up" | "down";
}): Promise<PipelineActionResult> {
  const { current, error } = await requirePipelineManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const stage = await prisma.pipelineStage.findUnique({ where: { id: input.stageId } });
  if (!stage) return { ok: false, error: "Etapa no encontrada." };

  const neighbor = await prisma.pipelineStage.findFirst({
    where: {
      pipelineId: stage.pipelineId,
      order: input.direction === "up" ? { lt: stage.order } : { gt: stage.order },
    },
    orderBy: { order: input.direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return { ok: false, error: "La etapa ya está en el extremo." };

  // Swap de `order` en una transacción — sin esto, un fallo a mitad de
  // camino podría dejar dos etapas con el mismo `order` (violaría el
  // @@unique([pipelineId, order]) del schema a medio actualizar) o
  // duplicado momentáneo si dos personas reordenan a la vez.
  await prisma.$transaction([
    // Paso intermedio a un valor negativo imposible de chocar, porque
    // @@unique([pipelineId, order]) rechaza un swap directo (a mitad de
    // la transacción ambas filas temporalmente comparten un valor).
    prisma.pipelineStage.update({ where: { id: stage.id }, data: { order: -1 } }),
    prisma.pipelineStage.update({ where: { id: neighbor.id }, data: { order: stage.order } }),
    prisma.pipelineStage.update({ where: { id: stage.id }, data: { order: neighbor.order } }),
  ]);

  revalidatePath("/settings");
  revalidatePath("/leads");
  revalidatePath("/sales");
  return { ok: true };
}

export async function deleteStageAction(input: { stageId: string }): Promise<PipelineActionResult> {
  const { current, error } = await requirePipelineManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const stage = await prisma.pipelineStage.findUnique({ where: { id: input.stageId } });
  if (!stage) return { ok: false, error: "Etapa no encontrada." };

  const [leadCount, saleCount] = await Promise.all([
    prisma.lead.count({ where: { stageId: input.stageId } }),
    prisma.sale.count({ where: { stageId: input.stageId } }),
  ]);
  if (leadCount > 0 || saleCount > 0) {
    return {
      ok: false,
      error: `No se puede eliminar: hay ${leadCount + saleCount} registro(s) todavía en esta etapa. Movelos a otra etapa primero.`,
    };
  }

  await prisma.pipelineStage.delete({ where: { id: input.stageId } });

  await logAudit({
    userId: current.id,
    action: "DELETE",
    entityType: "PipelineStage",
    entityId: input.stageId,
    fieldName: "name",
    oldValue: stage.name,
  });

  revalidatePath("/settings");
  revalidatePath("/leads");
  revalidatePath("/sales");
  return { ok: true };
}

export async function createPipelineAction(input: {
  entityType: PipelineEntity;
  name: string;
}): Promise<PipelineActionResult> {
  const { current, error } = await requirePipelineManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre del pipeline no puede estar vacío." };

  // isDefault siempre false acá a propósito: el pipeline que alimenta el
  // Kanban en vivo de Leads/Ventas es el que tiene isDefault=true (ver
  // leads/data.ts, sales/data.ts) y solo debe haber uno por entityType —
  // cambiar cuál es el default es una decisión más delicada (afecta qué ve
  // todo el mundo de inmediato) que crear un pipeline adicional, así que
  // se deja fuera de esta acción por ahora.
  const pipeline = await prisma.pipeline.create({
    data: { name, entityType: input.entityType, isDefault: false },
  });

  await logAudit({
    userId: current.id,
    action: "CREATE",
    entityType: "Pipeline",
    entityId: pipeline.id,
    fieldName: "name",
    newValue: name,
  });

  revalidatePath("/settings");
  return { ok: true };
}
