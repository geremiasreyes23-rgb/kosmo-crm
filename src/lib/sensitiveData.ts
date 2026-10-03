import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { maskSensitive } from "@/lib/utils";
import { sensitiveKeyLabel } from "@/lib/leads/lineSchema";

/**
 * Fase 4 — capa de cifrado a nivel de aplicación para SensitiveField
 * (sección 7 del brief de arquitectura: SSN, cuentas bancarias, routing
 * numbers... nunca en texto plano). AES-256-GCM con una clave simétrica
 * fija leída de SENSITIVE_DATA_ENCRYPTION_KEY (ver .env.local) — GCM en vez
 * de CBC porque además de confidencialidad da autenticación (authTag):
 * si alguien manipula la fila en la base de datos a mano, desencriptar
 * falla en vez de devolver basura silenciosamente.
 *
 * Formato guardado en SensitiveField.encryptedValue: "iv:authTag:ciphertext"
 * (los tres en hexadecimal, separados por ":") — un IV nuevo por cada
 * valor cifrado, nunca reutilizado (requisito de seguridad de GCM).
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recomendado para GCM

let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.SENSITIVE_DATA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "Falta SENSITIVE_DATA_ENCRYPTION_KEY en el entorno — no se pueden cifrar ni leer datos sensibles sin ella. Revisa tu .env.local."
    );
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error(
      "SENSITIVE_DATA_ENCRYPTION_KEY debe ser una clave de 32 bytes en hexadecimal (64 caracteres). El valor actual en .env.local no tiene ese formato."
    );
  }
  cachedKey = key;
  return key;
}

/** Cifra un valor en texto plano — nunca guardar el resultado de otra forma
 * que no sea en SensitiveField.encryptedValue. */
export function encryptSensitiveValue(plainValue: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainValue, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/** Descifra un valor guardado en SensitiveField.encryptedValue. Lanza si el
 * formato no es válido o si authTag no coincide (dato manipulado o clave
 * incorrecta) — a propósito no devuelve un valor parcial en ese caso. */
export function decryptSensitiveValue(encryptedValue: string): string {
  const key = getEncryptionKey();
  const parts = encryptedValue.split(":");
  if (parts.length !== 3) {
    throw new Error("Formato de valor cifrado inválido.");
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Vista previa enmascarada — reutiliza maskSensitive (mismo helper que ya
 * usaba el mock de Fase 1 para el SSN de ejemplo). Se puede mostrar sin
 * permiso especial, por eso se calcula y guarda junto con el valor cifrado
 * en vez de derivarla al vuelo cada vez (evitaría tener que descifrar solo
 * para mostrar la máscara). */
export function maskedPreviewFor(plainValue: string): string {
  return maskSensitive(plainValue, 4);
}

/** Catálogo de claves conocidas — solo para etiquetas legibles en la UI.
 * fieldKey sigue siendo texto libre en el schema (a propósito, ver
 * comentario en prisma/schema.prisma): una clave que no está acá se
 * muestra tal cual, no se rechaza. */
export const SENSITIVE_FIELD_LABELS: Record<string, string> = {
  ssn: "SSN",
  bank_account_number: "Número de cuenta bancaria",
  routing_number: "Routing number",
};

export function sensitiveFieldLabel(fieldKey: string): string {
  return SENSITIVE_FIELD_LABELS[fieldKey] ?? sensitiveKeyLabel(fieldKey);
}

export interface SensitiveFieldMaskedVM {
  id: string;
  fieldKey: string;
  label: string;
  maskedPreview: string;
  updatedAt: string;
}

/** Lista segura para renderizar en la página del cliente — nunca incluye el
 * valor real, así que no requiere chequear "sensitive_data:view" para
 * llamarse (el permiso solo protege revealSensitiveField, abajo). */
export async function getSensitiveFieldsMasked(clientId: string): Promise<SensitiveFieldMaskedVM[]> {
  const rows = await prisma.sensitiveField.findMany({
    where: { clientId },
    orderBy: { fieldKey: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    fieldKey: r.fieldKey,
    label: sensitiveFieldLabel(r.fieldKey),
    maskedPreview: r.maskedPreview,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Crea o reemplaza el valor de un campo sensible de un cliente. El
 * cifrado y el recálculo de la máscara pasan siempre por acá — nunca se
 * escribe encryptedValue/maskedPreview desde otro lado. */
export async function upsertSensitiveField(
  clientId: string,
  fieldKey: string,
  plainValue: string
): Promise<SensitiveFieldMaskedVM> {
  const encryptedValue = encryptSensitiveValue(plainValue);
  const maskedPreview = maskedPreviewFor(plainValue);
  const row = await prisma.sensitiveField.upsert({
    where: { clientId_fieldKey: { clientId, fieldKey } },
    update: { encryptedValue, maskedPreview },
    create: { clientId, fieldKey, encryptedValue, maskedPreview },
  });
  return {
    id: row.id,
    fieldKey: row.fieldKey,
    label: sensitiveFieldLabel(row.fieldKey),
    maskedPreview: row.maskedPreview,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Descifra el valor real de un campo sensible y deja registro en
 * SensitiveDataAccessLog — el llamador (un Server Action) es responsable de
 * verificar el permiso "sensitive_data:view" ANTES de llamar a esto; esta
 * función asume que ya se autorizó y solo se encarga de descifrar +
 * auditar, nunca de decidir el permiso (así el chequeo de permiso queda en
 * un solo lugar por acción, siguiendo el mismo patrón que el resto del
 * código — ver clients/actions.ts).
 */
export async function revealSensitiveField(
  fieldId: string,
  userId: string,
  reason?: string
): Promise<{ fieldKey: string; label: string; value: string } | null> {
  const row = await prisma.sensitiveField.findUnique({ where: { id: fieldId } });
  if (!row) return null;

  const value = decryptSensitiveValue(row.encryptedValue);

  await prisma.sensitiveDataAccessLog.create({
    data: {
      sensitiveFieldId: row.id,
      userId,
      reason: reason?.trim() || null,
    },
  });

  return { fieldKey: row.fieldKey, label: sensitiveFieldLabel(row.fieldKey), value };
}

// ───────────── Datos restringidos de Leads (antes de la conversión) ─────────────

/** Prefijo de las claves archivadas: un dato restringido que deja de
 * pertenecer al lead (cambio de línea de negocio, dependiente eliminado) no
 * se borra — SensitiveDataAccessLog lo referencia y la auditoría debe
 * conservarse — sino que se archiva y deja de mostrarse. */
export const ARCHIVED_SENSITIVE_PREFIX = "archived:";

export interface LeadSensitiveMaskedVM {
  id: string;
  fieldKey: string;
  label: string;
  maskedPreview: string;
}

/** Datos restringidos activos de un lead, solo enmascarados. */
export async function getLeadSensitiveMasked(leadId: string): Promise<LeadSensitiveMaskedVM[]> {
  const rows = await prisma.sensitiveField.findMany({
    where: { leadId, NOT: { fieldKey: { startsWith: ARCHIVED_SENSITIVE_PREFIX } } },
    orderBy: { fieldKey: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    fieldKey: r.fieldKey,
    label: sensitiveFieldLabel(r.fieldKey),
    maskedPreview: r.maskedPreview,
  }));
}

/** Crea o reemplaza (cifrado) un dato restringido de un lead. */
export async function upsertLeadSensitiveField(
  tx: Prisma.TransactionClient,
  leadId: string,
  fieldKey: string,
  plainValue: string
): Promise<string> {
  const encryptedValue = encryptSensitiveValue(plainValue);
  const maskedPreview = maskedPreviewFor(plainValue);
  const row = await tx.sensitiveField.upsert({
    where: { leadId_fieldKey: { leadId, fieldKey } },
    update: { encryptedValue, maskedPreview },
    create: { leadId, fieldKey, encryptedValue, maskedPreview },
  });
  return row.id;
}

/** Archiva los datos restringidos del lead cuya clave ya no es válida. */
export async function archiveLeadSensitiveFields(
  tx: Prisma.TransactionClient,
  leadId: string,
  keepKeys: Set<string>
): Promise<string[]> {
  const rows = await tx.sensitiveField.findMany({
    where: { leadId, NOT: { fieldKey: { startsWith: ARCHIVED_SENSITIVE_PREFIX } } },
    select: { id: true, fieldKey: true },
  });
  const archived: string[] = [];
  for (const r of rows) {
    if (keepKeys.has(r.fieldKey)) continue;
    await tx.sensitiveField.update({
      where: { id: r.id },
      data: { fieldKey: `${ARCHIVED_SENSITIVE_PREFIX}${Date.now()}:${r.fieldKey}` },
    });
    archived.push(r.fieldKey);
  }
  return archived;
}
