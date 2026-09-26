"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { uploadDocumentAction } from "@/lib/documents/actions";
import type { DocumentVM } from "@/types";
import { formatDate } from "@/lib/utils";
import { FileText, Paperclip } from "lucide-react";

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

const MAX_DOCUMENT_SIZE_MB = 8;

export function DocumentsTab({
  leadId,
  clientId,
  initialDocuments,
  canEdit,
}: {
  leadId?: string;
  clientId?: string;
  initialDocuments: DocumentVM[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > MAX_DOCUMENT_SIZE_MB * 1024 * 1024) {
        setError(`"${file.name}" supera el límite de ${MAX_DOCUMENT_SIZE_MB}MB.`);
        continue;
      }
      const dataUrl = await readFileAsDataUrl(file);
      const result = await uploadDocumentAction({
        fileName: file.name,
        dataUrl,
        sizeBytes: file.size,
        relatedLeadId: leadId,
        relatedClientId: clientId,
      });
      if (!result.ok) {
        setError(result.error ?? `No se pudo subir "${file.name}".`);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="space-y-2">
          {error && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-[var(--status-critical)]">
              {error}
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Paperclip className="h-4 w-4" /> {uploading ? "Subiendo..." : "Adjuntar documento"}
          </Button>
        </div>
      )}

      {initialDocuments.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">Sin documentos adjuntos todavía.</p>
      ) : (
        <div className="space-y-2">
          {initialDocuments.map((d) => (
            <a
              key={d.id}
              href={d.fileUrl}
              download={d.fileName}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-hairline)] p-3 hover:bg-[var(--surface-hover)]"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.fileName}</p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {d.uploadedByName} · {formatDate(d.uploadedAt)} · {formatBytes(Math.round((d.fileUrl.length * 3) / 4))}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
