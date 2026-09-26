import "server-only";

import type { MailFolderType } from "@prisma/client";

/** Catálogo fijo de carpetas de sistema — nombre visible + orden. Vive en un
 * solo lugar para que la UI (sidebar de carpetas) y el backfill (ensureMailbox
 * en mailbox.ts, y el seed) nunca se desincronicen. */
export const SYSTEM_FOLDERS: { type: Exclude<MailFolderType, "CUSTOM">; name: string; order: number }[] = [
  { type: "INBOX", name: "Recibidos", order: 0 },
  { type: "SENT", name: "Enviados", order: 1 },
  { type: "DRAFTS", name: "Borradores", order: 2 },
  { type: "ARCHIVE", name: "Archivados", order: 3 },
  { type: "TRASH", name: "Papelera", order: 4 },
];
