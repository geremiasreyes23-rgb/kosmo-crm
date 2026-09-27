"use client";

import { useState } from "react";
import { Paperclip, X, Send, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { RecipientPicker } from "./RecipientPicker";
import type { MailRecipientOption, MailSettingsVM } from "@/app/(app)/mail/data";
import type { AttachmentInput, SendMessageInput } from "@/app/(app)/mail/actions";

export interface ComposeInitial {
  draftMessageId?: string;
  to?: MailRecipientOption[];
  cc?: MailRecipientOption[];
  subject?: string;
  body?: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ComposeModal({
  open,
  onClose,
  directory,
  settings,
  initial,
  onSend,
  onSaveDraft,
}: {
  open: boolean;
  onClose: () => void;
  directory: MailRecipientOption[];
  settings: MailSettingsVM;
  initial?: ComposeInitial;
  onSend: (input: SendMessageInput) => Promise<{ ok: boolean; error?: string }>;
  onSaveDraft: (input: SendMessageInput) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [to, setTo] = useState<MailRecipientOption[]>(initial?.to ?? []);
  const [cc, setCc] = useState<MailRecipientOption[]>(initial?.cc ?? []);
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [attachments, setAttachments] = useState<AttachmentInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"send" | "draft" | null>(null);

  function reset() {
    setTo(initial?.to ?? []);
    setCc(initial?.cc ?? []);
    setSubject(initial?.subject ?? "");
    setBody(initial?.body ?? "");
    setAttachments([]);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const maxBytes = settings.maxAttachmentSizeMb * 1024 * 1024;
    const next: AttachmentInput[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!settings.allowedExtensions.includes(ext)) {
        setError(`".${ext}" no está permitido. Formatos permitidos: ${settings.allowedExtensions.join(", ")}.`);
        continue;
      }
      if (file.size > maxBytes) {
        setError(`"${file.name}" supera el límite de ${settings.maxAttachmentSizeMb}MB.`);
        continue;
      }
      const dataUrl = await readFileAsDataUrl(file);
      next.push({ fileName: file.name, mimeType: file.type || "application/octet-stream", dataUrl, sizeBytes: file.size });
    }
    if (next.length) setAttachments((prev) => [...prev, ...next]);
  }

  function removeAttachment(fileName: string) {
    setAttachments((prev) => prev.filter((a) => a.fileName !== fileName));
  }

  function buildInput(): SendMessageInput {
    return {
      draftMessageId: initial?.draftMessageId,
      to: to.map((t) => t.address),
      cc: cc.map((c) => c.address),
      subject,
      body,
      attachments,
    };
  }

  async function handleSend() {
    if (to.length === 0) {
      setError('Agrega al menos un destinatario en "Para".');
      return;
    }
    if (!subject.trim()) {
      setError("El asunto es obligatorio.");
      return;
    }
    setBusy("send");
    setError(null);
    const result = await onSend(buildInput());
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? "No se pudo enviar el correo.");
      return;
    }
    handleClose();
  }

  async function handleSaveDraft() {
    setBusy("draft");
    setError(null);
    const result = await onSaveDraft(buildInput());
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? "No se pudo guardar el borrador.");
      return;
    }
    handleClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-xl bg-[var(--surface-card)] shadow-2xl sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-5 py-3.5">
          <h2 className="text-sm font-semibold">Nuevo correo interno</h2>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {error && (
            <p className="rounded-lg border border-red-200 bg-[var(--status-critical-bg)] px-3 py-2 text-xs text-[var(--status-critical)]">
              {error}
            </p>
          )}

          <RecipientPicker label="Para" directory={directory} selected={to} onChange={setTo} />
          <RecipientPicker label="CC" directory={directory} selected={cc} onChange={setCc} />

          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe tu mensaje…" rows={10} />

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <span
                  key={a.fileName}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-sunken)] py-1 pl-2.5 pr-1.5 text-xs"
                >
                  <Paperclip className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                  {a.fileName}
                  <span className="text-[var(--ink-muted)]">({formatBytes(a.sizeBytes)})</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.fileName)}
                    className="rounded-full p-0.5 text-[var(--ink-muted)] hover:bg-black/5"
                    aria-label={`Quitar ${a.fileName}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-hairline)] px-3 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]">
            <Paperclip className="h-3.5 w-3.5" /> Adjuntar archivo
            <input type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          </label>
          <p className="text-[11px] text-[var(--ink-muted)]">
            Máximo {settings.maxAttachmentSizeMb}MB por archivo. Tipos permitidos: {settings.allowedExtensions.join(", ")}.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border-hairline)] px-5 py-3.5">
          <Button variant="secondary" size="sm" onClick={handleSaveDraft} disabled={busy !== null}>
            <Save className="h-4 w-4" /> {busy === "draft" ? "Guardando..." : "Guardar borrador"}
          </Button>
          <Button size="sm" onClick={handleSend} disabled={busy !== null}>
            <Send className="h-4 w-4" /> {busy === "send" ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
