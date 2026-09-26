"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SquarePen,
  Inbox as InboxIcon,
  Send as SendIcon,
  FileEdit,
  Archive,
  Trash2,
  Paperclip,
  ArchiveRestore,
  Trash,
  Reply,
  Download,
  Mail as MailIcon,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { MailOverview, MailFolderVM, MailMessageRowVM, MailRecipientOption, MailSettingsVM } from "@/app/(app)/mail/data";
import {
  loadFolderMessagesAction,
  getMessageDetailAction,
  sendMessageAction,
  saveDraftAction,
  moveMessageAction,
  permanentlyDeleteMessageAction,
  downloadAttachmentAction,
  type MailMessageDetailVM,
} from "@/app/(app)/mail/actions";
import { ComposeModal, type ComposeInitial } from "./ComposeModal";

const FOLDER_ICONS: Record<string, typeof InboxIcon> = {
  INBOX: InboxIcon,
  SENT: SendIcon,
  DRAFTS: FileEdit,
  ARCHIVE: Archive,
  TRASH: Trash2,
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString("es-DO", { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString("es-DO", { day: "2-digit", month: "short" });
}

export function MailView({
  currentUser,
  overview,
  directory,
  settings,
}: {
  currentUser: { id: string; firstName: string; lastName: string };
  overview: MailOverview;
  directory: MailRecipientOption[];
  settings: MailSettingsVM;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [folders, setFolders] = useState<MailFolderVM[]>(overview.folders);
  const [activeFolderId, setActiveFolderId] = useState(overview.activeFolder.id);
  const [messages, setMessages] = useState<MailMessageRowVM[]>(overview.messages);
  const [loadingFolder, setLoadingFolder] = useState(false);

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MailMessageDetailVM | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<ComposeInitial | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeFolder = folders.find((f) => f.id === activeFolderId) ?? folders[0];

  async function handleFolderClick(folder: MailFolderVM) {
    setActiveFolderId(folder.id);
    setSelectedRowId(null);
    setDetail(null);
    setLoadingFolder(true);
    const result = await loadFolderMessagesAction(folder.id);
    setLoadingFolder(false);
    if (result.ok) setMessages(result.messages);
  }

  async function handleSelectMessage(row: MailMessageRowVM) {
    setSelectedRowId(row.id);
    setLoadingDetail(true);
    const result = await getMessageDetailAction(row.id);
    setLoadingDetail(false);
    if (result.ok) {
      setDetail(result.message);
      // Refleja "leído" al instante en la lista, sin esperar un refetch completo.
      setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, isRead: true } : m)));
    }
  }

  function refreshAfterMutation() {
    // Recarga carpetas + conteos (ej. "no leídos" de Recibidos) — acción
    // administrativa de baja frecuencia, mismo criterio que CustomFieldsPanel.
    startTransition(() => router.refresh());
  }

  async function handleMove(rowId: string, target: "ARCHIVE" | "TRASH" | "INBOX") {
    setActionError(null);
    const result = await moveMessageAction(rowId, target);
    if (!result.ok) {
      setActionError(result.error ?? "No se pudo mover el correo.");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== rowId));
    if (selectedRowId === rowId) {
      setSelectedRowId(null);
      setDetail(null);
    }
    refreshAfterMutation();
  }

  async function handlePermanentDelete(rowId: string) {
    if (!window.confirm("¿Eliminar este correo de forma permanente? No se puede deshacer.")) return;
    setActionError(null);
    const result = await permanentlyDeleteMessageAction(rowId);
    if (!result.ok) {
      setActionError(result.error ?? "No se pudo eliminar.");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== rowId));
    setSelectedRowId(null);
    setDetail(null);
    refreshAfterMutation();
  }

  async function handleDownload(attachmentId: string) {
    const result = await downloadAttachmentAction(attachmentId);
    if (!result.ok) {
      setActionError(result.error ?? "No se pudo descargar el adjunto.");
      return;
    }
    const a = document.createElement("a");
    a.href = result.dataUrl;
    a.download = result.fileName;
    a.click();
  }

  function openCompose(initial?: ComposeInitial) {
    setComposeInitial(initial);
    setComposeOpen(true);
  }

  function handleReply() {
    if (!detail) return;
    const senderOption = directory.find((d) => d.address === detail.senderAddress);
    openCompose({
      to: senderOption
        ? [senderOption]
        : [{ id: detail.senderAddress, name: detail.senderName, address: detail.senderAddress, department: null, jobTitle: null, roleName: "" }],
      subject: detail.subject.startsWith("RE:") ? detail.subject : `RE: ${detail.subject}`,
    });
  }

  function toRecipientOption(address: string): MailRecipientOption {
    return (
      directory.find((d) => d.address === address) ?? {
        id: address,
        name: address,
        address,
        department: null,
        jobTitle: null,
        roleName: "",
      }
    );
  }

  function handleEditDraft() {
    if (!detail) return;
    openCompose({
      draftMessageId: detail.id,
      to: detail.toAddresses.map(toRecipientOption),
      cc: detail.ccAddresses.map(toRecipientOption),
      subject: detail.subject === "(sin asunto)" ? "" : detail.subject,
      body: detail.body,
    });
  }

  async function handleSend(input: Parameters<typeof sendMessageAction>[0]) {
    const result = await sendMessageAction(input);
    if (result.ok) refreshAfterMutation();
    return result;
  }

  async function handleSaveDraft(input: Parameters<typeof saveDraftAction>[0]) {
    const result = await saveDraftAction(input);
    if (result.ok) refreshAfterMutation();
    return result;
  }

  /** Vuelve a cargar la carpeta activa — el ícono de refrescar de la barra
   * sobre la lista de mensajes (no hay nada "de mentira": recarga los
   * mensajes reales, igual que cambiar de carpeta y volver). */
  function handleRefreshFolder() {
    if (activeFolder) handleFolderClick(activeFolder);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Sin PageHeader — igual que Mensajería, el correo ocupa todo el alto
          disponible. "Redactar" pasó a ser el botón flotante de arriba de
          las carpetas (ver abajo), estilo Gmail pero con los colores de la
          plataforma en vez de un tema oscuro. */}
      {actionError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-[var(--status-critical-bg)] px-3 py-2 text-xs text-[var(--status-critical)]">
          {actionError}
        </p>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] shadow-sm">
        {/* Carpetas */}
        <div className="w-52 shrink-0 border-r border-[var(--border-hairline)] p-3">
          <button
            type="button"
            onClick={() => openCompose()}
            className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-full bg-[var(--brand-500)] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-[transform,box-shadow,background-color] hover:bg-[var(--brand-600)] hover:shadow-lg active:scale-[0.98]"
          >
            <SquarePen className="h-4 w-4" /> Redactar
          </button>

          {folders.map((folder) => {
            const Icon = FOLDER_ICONS[folder.type] ?? MailIcon;
            const active = folder.id === activeFolderId;
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => handleFolderClick(folder)}
                className={cn(
                  "mb-0.5 flex w-full items-center gap-2.5 rounded-full px-3.5 py-2 text-left text-sm font-medium transition-colors",
                  active ? "bg-[var(--brand-500)]/10 text-[var(--brand-600)]" : "text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{folder.name}</span>
                {folder.unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e04f4f] px-1.5 text-[11px] font-semibold text-white">
                    {folder.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Lista de mensajes */}
        <div className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-[var(--border-hairline)]">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-hairline)] px-3 py-2">
            <button
              type="button"
              onClick={handleRefreshFolder}
              title="Actualizar"
              disabled={loadingFolder}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loadingFolder && "animate-spin")} />
            </button>
            <span className="text-xs text-[var(--ink-muted)]">
              {messages.length} {messages.length === 1 ? "correo" : "correos"}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingFolder ? (
            <p className="p-4 text-center text-sm text-[var(--ink-muted)]">Cargando…</p>
          ) : messages.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--ink-muted)]">Esta carpeta está vacía.</p>
          ) : (
            messages.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => handleSelectMessage(row)}
                className={cn(
                  "block w-full border-b border-[var(--border-hairline)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]",
                  selectedRowId === row.id && "bg-[var(--surface-sunken)]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-sm", !row.isRead && "font-semibold")}>{row.counterpartName}</span>
                  <span className="shrink-0 text-[11px] text-[var(--ink-muted)]">{formatTimestamp(row.timestamp)}</span>
                </div>
                <p className={cn("mt-0.5 truncate text-sm", !row.isRead && "font-semibold")}>
                  {row.isDraft && <span className="text-[var(--status-warning)]">[Borrador] </span>}
                  {row.subject}
                </p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-[var(--ink-muted)]">
                  {row.hasAttachments && <Paperclip className="h-3 w-3 shrink-0" />}
                  {row.snippet}
                </p>
              </button>
            ))
          )}
          </div>
        </div>

        {/* Detalle */}
        <div className="flex min-w-0 flex-1 flex-col">
          {loadingDetail ? (
            <p className="p-6 text-center text-sm text-[var(--ink-muted)]">Cargando…</p>
          ) : !detail ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-[var(--ink-muted)]">Selecciona un correo para leerlo.</p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-[var(--border-hairline)] px-5 py-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">{detail.subject}</h2>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    De <span className="font-medium text-[var(--ink-secondary)]">{detail.senderName}</span> ({detail.senderAddress})
                  </p>
                  {detail.toAddresses.length > 0 && (
                    <p className="text-xs text-[var(--ink-muted)]">Para: {detail.toAddresses.join(", ")}</p>
                  )}
                  {detail.ccAddresses.length > 0 && (
                    <p className="text-xs text-[var(--ink-muted)]">CC: {detail.ccAddresses.join(", ")}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {detail.isDraft && detail.isOwnCopy && (
                    <Button size="sm" variant="secondary" onClick={handleEditDraft}>
                      Continuar editando
                    </Button>
                  )}
                  {!detail.isOwnCopy && (
                    <button
                      type="button"
                      title="Responder"
                      onClick={handleReply}
                      className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                    >
                      <Reply className="h-4 w-4" />
                    </button>
                  )}
                  {selectedRowId && activeFolder?.type !== "TRASH" && activeFolder?.type !== "ARCHIVE" && (
                    <button
                      type="button"
                      title="Archivar"
                      onClick={() => selectedRowId && handleMove(selectedRowId, "ARCHIVE")}
                      className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  )}
                  {selectedRowId && activeFolder?.type === "TRASH" ? (
                    <>
                      <button
                        type="button"
                        title="Restaurar a Recibidos"
                        onClick={() => selectedRowId && handleMove(selectedRowId, "INBOX")}
                        className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                      >
                        <ArchiveRestore className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Eliminar permanentemente"
                        onClick={() => selectedRowId && handlePermanentDelete(selectedRowId)}
                        className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--status-critical-bg)] hover:text-[var(--status-critical)]"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    selectedRowId && (
                      <button
                        type="button"
                        title="Mover a la papelera"
                        onClick={() => selectedRowId && handleMove(selectedRowId, "TRASH")}
                        className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--status-critical-bg)] hover:text-[var(--status-critical)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink-primary)]">{detail.body}</p>
              </div>

              {detail.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-[var(--border-hairline)] px-5 py-3">
                  {detail.attachments.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleDownload(a.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-sunken)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--surface-hover)]"
                    >
                      <Paperclip className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                      {a.fileName}
                      <Download className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        directory={directory}
        settings={settings}
        initial={composeInitial}
        onSend={handleSend}
        onSaveDraft={handleSaveDraft}
      />
    </div>
  );
}
