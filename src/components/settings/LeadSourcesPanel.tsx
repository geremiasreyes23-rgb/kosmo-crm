"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Pencil, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import {
  createLeadSourceAction,
  renameLeadSourceAction,
  deleteLeadSourceAction,
} from "@/app/(app)/settings/catalogs-actions";

export interface LeadSourceRow {
  id: string;
  name: string;
}

export function LeadSourcesPanel({
  initialSources,
  canManage,
}: {
  initialSources: LeadSourceRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function handleCreate() {
    if (!newName.trim()) return;
    setBusyId("new");
    setError(null);
    const result = await createLeadSourceAction({ name: newName });
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "No se pudo crear el origen.");
      return;
    }
    setNewName("");
    router.refresh();
  }

  async function handleRename(sourceId: string) {
    setBusyId(sourceId);
    setError(null);
    const result = await renameLeadSourceAction({ sourceId, name: editingName });
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "No se pudo renombrar.");
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(source: LeadSourceRow) {
    if (!window.confirm(`¿Eliminar el origen "${source.name}"?`)) return;
    setBusyId(source.id);
    setError(null);
    const result = await deleteLeadSourceAction({ sourceId: source.id });
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "No se pudo eliminar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-[var(--status-critical-bg)] bg-[var(--status-critical-bg)] px-3 py-2 text-xs text-[var(--status-critical)]">
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        {initialSources.map((source) => (
          <div
            key={source.id}
            className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] px-3 py-2 text-sm"
          >
            {editingId === source.id ? (
              <div className="flex flex-1 items-center gap-2">
                <Input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="h-8"
                />
                <button
                  className="rounded-md p-1.5 text-[var(--status-positive)] hover:bg-[var(--surface-hover)]"
                  disabled={busyId === source.id}
                  onClick={() => handleRename(source.id)}
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                  onClick={() => setEditingId(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <span className="font-medium">{source.name}</span>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                      onClick={() => {
                        setEditingId(source.id);
                        setEditingName(source.name);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="rounded-md p-1.5 text-[var(--status-critical)] hover:bg-[var(--surface-hover)]"
                      disabled={busyId === source.id}
                      onClick={() => handleDelete(source)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {initialSources.length === 0 && <p className="text-sm text-[var(--ink-muted)]">No hay orígenes todavía.</p>}
      </div>

      {canManage && (
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder='Ej. "Google Ads"'
            className="h-9 max-w-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <Button size="sm" variant="secondary" disabled={busyId === "new"} onClick={handleCreate}>
            <Plus className="h-4 w-4" /> Agregar origen
          </Button>
        </div>
      )}
    </div>
  );
}
