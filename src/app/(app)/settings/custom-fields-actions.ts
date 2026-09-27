"use server";

import { revalidatePath } from "next/cache";
import type { CustomFieldEntity, CustomFieldType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth";

/**
 * Campos personalizados (Configuración → Campos personalizados) — el modelo
 * `CustomField`/`CustomFieldValue` ya existía en el schema y el formulario
 * de Leads (`getLeadFormOptions` en app/(app)/leads/data.ts) ya lee de acá
 * en tiempo real; lo único que faltaba era ESTA pantalla para poder crear
 * filas de verdad — antes el botón "Nuevo campo" no tenía ni `onClick`.
 */

export interface CustomFieldActionResult {
  ok: boolean;
  error?: string;
}

export interface CreateCustomFieldInput {
  entityType: CustomFieldEntity;
  label: string;
  fieldType: CustomFieldType;
  /** Solo para SELECT / MULTISELECT. */
  options?: string[];
  isRequired?: boolean;
  /** Solo aplica a LEAD — el mismo id que ya usa el formulario de leads para
   * mostrar el campo solo cuando esa línea de negocio está seleccionada.
   * null/undefined = el campo queda "siempre disponible" en el catálogo
   * "+ Agregar campo". */
  insuranceLineId?: string | null;
  section?: string;
}

/** Deriva una clave interna (CustomField.name) legible a partir de la
 * etiqueta que escribió el usuario — ej. "¿Tiene cobertura dental?" ->
 * "tieneCoberturaDental". Esa clave es la que se usa como key del objeto
 * `customFieldValues` en todo el formulario de leads, así que tiene que ser
 * un identificador válido (sin espacios ni símbolos). */
function slugifyFieldName(label: string): string {
  const words = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) return "campo";
  return words
    .map((word, i) => (i === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase()))
    .join("");
}

export async function createCustomFieldAction(
  input: CreateCustomFieldInput
): Promise<CustomFieldActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "settings", "create")) {
    return { ok: false, error: "No tienes permiso para crear campos personalizados." };
  }

  const label = input.label.trim();
  if (!label) return { ok: false, error: "El nombre del campo es obligatorio." };

  const needsOptions = input.fieldType === "SELECT" || input.fieldType === "MULTISELECT";
  const options = (input.options ?? []).map((o) => o.trim()).filter(Boolean);
  if (needsOptions && options.length === 0) {
    return { ok: false, error: "Agrega al menos una opción para este tipo de campo." };
  }

  // Clave interna única dentro de la misma entidad — si ya existe una con el
  // mismo nombre derivado, se le agrega un sufijo numérico en vez de fallar.
  const base = slugifyFieldName(label);
  let name = base;
  for (let suffix = 2; suffix < 50; suffix++) {
    const clash = await prisma.customField.findUnique({
      where: { entityType_name: { entityType: input.entityType, name } },
    });
    if (!clash) break;
    name = `${base}${suffix}`;
  }

  const last = await prisma.customField.findFirst({
    where: { entityType: input.entityType },
    orderBy: { order: "desc" },
  });

  await prisma.customField.create({
    data: {
      entityType: input.entityType,
      name,
      label,
      fieldType: input.fieldType,
      isRequired: input.isRequired ?? false,
      options: needsOptions ? options : undefined,
      insuranceLineId: input.entityType === "LEAD" ? input.insuranceLineId || null : null,
      section: input.section?.trim() || null,
      order: (last?.order ?? -1) + 1,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/leads");
  return { ok: true };
}

export async function setCustomFieldVisibilityAction(
  id: string,
  isVisible: boolean
): Promise<CustomFieldActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "settings", "edit")) {
    return { ok: false, error: "No tienes permiso para editar campos personalizados." };
  }
  await prisma.customField.update({ where: { id }, data: { isVisible } });
  revalidatePath("/settings");
  revalidatePath("/leads");
  return { ok: true };
}

export async function deleteCustomFieldAction(id: string): Promise<CustomFieldActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "settings", "delete")) {
    return { ok: false, error: "No tienes permiso para eliminar campos personalizados." };
  }

  // Si ya hay registros (leads, clientes, etc.) con un valor guardado en
  // este campo, borrarlo perdería esos datos silenciosamente — mejor
  // desactivarlo (isVisible=false) y conservar el historial.
  const valueCount = await prisma.customFieldValue.count({ where: { customFieldId: id } });
  if (valueCount > 0) {
    return {
      ok: false,
      error: "Este campo ya tiene datos guardados en registros existentes. Desactívalo en vez de eliminarlo.",
    };
  }

  await prisma.customField.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/leads");
  return { ok: true };
}
