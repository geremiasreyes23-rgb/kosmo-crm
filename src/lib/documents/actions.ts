"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth";
import { assertRelatedOwnership } from "@/lib/relatedRecords";

export interface DocumentActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface UploadDocumentInput {
  fileName: string;
  /** Data URL (base64) ya leída en el cliente — mismo patrón que los
   * adjuntos de Correo interno (src/components/mail/ComposeModal.tsx):
   * sin almacenamiento externo, el archivo se guarda embebido. */
  dataUrl: string;
  sizeBytes: number;
  category?: string;
  relatedLeadId?: string;
  relatedClientId?: string;
}

const MAX_DOCUMENT_SIZE_MB = 8;

export async function uploadDocumentAction(input: UploadDocumentInput): Promise<DocumentActionResult> {
  const user = await requireUser();

  const fileName = input.fileName.trim();
  if (!fileName) return { ok: false, error: "El archivo no tiene nombre." };
  if (!input.dataUrl.startsWith("data:")) {
    return { ok: false, error: "No se pudo procesar el archivo — vuelve a adjuntarlo." };
  }
  if (input.sizeBytes > MAX_DOCUMENT_SIZE_MB * 1024 * 1024) {
    return { ok: false, error: `"${fileName}" supera el límite de ${MAX_DOCUMENT_SIZE_MB}MB.` };
  }

  const leadId = input.relatedLeadId || null;
  const clientId = input.relatedClientId || null;
  if (!leadId && !clientId) {
    return { ok: false, error: "Selecciona a qué lead o cliente pertenece el documento." };
  }
  if (!hasPermission(user, leadId ? "leads" : "clients", "edit")) {
    return { ok: false, error: "No tienes permiso para subir documentos aquí." };
  }

  const ownershipError = await assertRelatedOwnership(leadId, clientId, user);
  if (ownershipError) return { ok: false, error: ownershipError };

  const document = await prisma.document.create({
    data: {
      fileName,
      fileUrl: input.dataUrl,
      category: input.category?.trim() || null,
      uploadedById: user.id,
      leadId,
      clientId,
    },
  });

  if (leadId) revalidatePath(`/leads/${leadId}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
  return { ok: true, id: document.id };
}
