import { requireUser, hasPermission } from "@/lib/auth";
import { getDocumentsForUser } from "@/lib/documents/data";
import { getRelatedEntityOptions } from "@/lib/relatedRecords";
import { DocumentsView } from "./DocumentsView";

export const dynamic = "force-dynamic";

// Fase 12 — Documentos como módulo independiente: hasta ahora los
// documentos solo se veían embebidos como tab dentro de Cliente/Lead
// (ver DocumentsTab.tsx, que sigue existiendo y sigue funcionando igual).
// Esta pantalla es un repositorio central: todos los documentos dentro del
// alcance del usuario (mismo alcance por rol que el resto del CRM), sin
// importar a qué lead/cliente/venta/póliza estén ligados — reutiliza
// getDocumentsForUser() sin filtro, el mismo dato que ya alimenta los tabs.
export default async function DocumentsPage() {
  const user = await requireUser();
  const [documents, relatedOptions] = await Promise.all([
    getDocumentsForUser(user),
    getRelatedEntityOptions(user),
  ]);

  // Mismo permiso que ya exige uploadDocumentAction según a qué se ligue el
  // documento (leads:edit o clients:edit) — si no tiene ninguno de los dos,
  // el botón de subir no tiene sentido mostrarlo.
  const canUpload = hasPermission(user, "leads", "edit") || hasPermission(user, "clients", "edit");

  return (
    <DocumentsView initialDocuments={documents} relatedOptions={relatedOptions} canUpload={canUpload} />
  );
}
