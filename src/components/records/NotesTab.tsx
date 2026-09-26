"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { createNoteAction } from "@/lib/notes/actions";
import type { NoteVM } from "@/types";
import { formatDate, formatTime } from "@/lib/utils";
import { StickyNote } from "lucide-react";

export function NotesTab({
  leadId,
  clientId,
  initialNotes,
  canEdit,
}: {
  leadId?: string;
  clientId?: string;
  initialNotes: NoteVM[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await createNoteAction({
      body,
      relatedLeadId: leadId,
      relatedClientId: clientId,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "No se pudo guardar la nota.");
      return;
    }
    setBody("");
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
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribe una nota..."
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSubmit} disabled={submitting || !body.trim()}>
              {submitting ? "Guardando..." : "Agregar nota"}
            </Button>
          </div>
        </div>
      )}

      {initialNotes.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">Sin notas todavía.</p>
      ) : (
        <div className="space-y-2">
          {initialNotes.map((n) => (
            <div key={n.id} className="rounded-lg border border-[var(--border-hairline)] p-3">
              <div className="flex items-start gap-2">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
                <p className="whitespace-pre-wrap text-sm text-[var(--ink-primary)]">{n.body}</p>
              </div>
              <p className="mt-1.5 pl-6 text-xs text-[var(--ink-muted)]">
                {formatDate(n.createdAt)} · {formatTime(n.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
