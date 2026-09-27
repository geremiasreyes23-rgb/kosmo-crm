"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUp, ArrowDown, Trash2, Plus, Trophy, XCircle, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input } from "@/components/ui/Field";
import {
  createStageAction,
  renameStageAction,
  setStageFlagAction,
  moveStageAction,
  deleteStageAction,
  createPipelineAction,
} from "@/app/(app)/settings/pipelines-actions";

export interface PipelineStageRow {
  id: string;
  name: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
}

export interface PipelineRow {
  id: string;
  name: string;
  entityType: "LEAD" | "SALE";
  isDefault: boolean;
  stages: PipelineStageRow[];
}

const ENTITY_LABEL: Record<"LEAD" | "SALE", string> = {
  LEAD: "Leads",
  SALE: "Ventas",
};

export function PipelinesPanel({
  initialPipelines,
  canManage,
}: {
  initialPipelines: PipelineRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [entityTab, setEntityTab] = useState<"LEAD" | "SALE">("LEAD");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newStageName, setNewStageName] = useState<Record<string, string>>({});
  const [createPipelineOpen, setCreatePipelineOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");

  const pipelinesForTab = initialPipelines.filter((p) => p.entityType === entityTab);

  async function runAction(stageId: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusyId(stageId);
    setError(null);
    const result = await fn();
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "No se pudo completar la acción.");
      return;
    }
    router.refresh();
  }

  async function handleAddStage(pipelineId: string) {
    const name = (newStageName[pipelineId] ?? "").trim();
    if (!name) return;
    setBusyId(pipelineId);
    setError(null);
    const result = await createStageAction({ pipelineId, name });
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "No se pudo crear la etapa.");
      return;
    }
    setNewStageName((prev) => ({ ...prev, [pipelineId]: "" }));
    router.refresh();
  }

  async function handleCreatePipeline() {
    const name = newPipelineName.trim();
    if (!name) return;
    setError(null);
    const result = await createPipelineAction({ entityType: entityTab, name });
    if (!result.ok) {
      setError(result.error ?? "No se pudo crear el pipeline.");
      return;
    }
    setCreatePipelineOpen(false);
    setNewPipelineName("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 rounded-lg border border-[var(--border-hairline)] p-1">
          {(["LEAD", "SALE"] as const).map((et) => (
            <button
              key={et}
              onClick={() => setEntityTab(et)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                entityTab === et
                  ? "bg-[var(--brand-500)] text-white"
                  : "text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {ENTITY_LABEL[et]}
            </button>
          ))}
        </div>
        {canManage && (
          <Button size="sm" variant="secondary" onClick={() => setCreatePipelineOpen(true)}>
            <Plus className="h-4 w-4" /> Nuevo pipeline
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-[var(--status-critical-bg)] bg-[var(--status-critical-bg)] px-3 py-2 text-xs text-[var(--status-critical)]">
          {error}
        </p>
      )}

      {pipelinesForTab.length === 0 && (
        <p className="text-sm text-[var(--ink-muted)]">No hay pipelines de {ENTITY_LABEL[entityTab]} todavía.</p>
      )}

      {pipelinesForTab.map((pipeline) => (
        <div key={pipeline.id} className="rounded-xl border border-[var(--border-hairline)]">
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{pipeline.name}</p>
              {pipeline.isDefault && <Badge status="info">En uso — Kanban en vivo</Badge>}
            </div>
          </div>

          <div className="divide-y divide-[var(--border-hairline)]">
            {pipeline.stages.map((stage, idx) => (
              <div key={stage.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-5 shrink-0 text-center text-xs text-[var(--ink-muted)]">{idx + 1}</span>

                {editingStageId === stage.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-8"
                    />
                    <button
                      className="rounded-md p-1.5 text-[var(--status-positive)] hover:bg-[var(--surface-hover)]"
                      disabled={busyId === stage.id}
                      onClick={() =>
                        runAction(stage.id, async () => {
                          const r = await renameStageAction({ stageId: stage.id, name: editingName });
                          if (r.ok) setEditingStageId(null);
                          return r;
                        })
                      }
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                      onClick={() => setEditingStageId(null)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="flex flex-1 items-center gap-1.5 text-left text-sm font-medium disabled:opacity-60"
                    disabled={!canManage}
                    onClick={() => {
                      setEditingStageId(stage.id);
                      setEditingName(stage.name);
                    }}
                  >
                    {stage.name}
                    {canManage && <Pencil className="h-3 w-3 text-[var(--ink-muted)]" />}
                  </button>
                )}

                <button
                  disabled={!canManage || busyId === stage.id}
                  onClick={() =>
                    runAction(stage.id, () =>
                      setStageFlagAction({ stageId: stage.id, flag: "isWon", value: !stage.isWon })
                    )
                  }
                  title="Marcar como etapa ganada"
                >
                  <Badge status={stage.isWon ? "good" : "neutral"}>
                    <Trophy className="h-3 w-3" /> Ganada
                  </Badge>
                </button>
                <button
                  disabled={!canManage || busyId === stage.id}
                  onClick={() =>
                    runAction(stage.id, () =>
                      setStageFlagAction({ stageId: stage.id, flag: "isLost", value: !stage.isLost })
                    )
                  }
                  title="Marcar como etapa perdida"
                >
                  <Badge status={stage.isLost ? "critical" : "neutral"}>
                    <XCircle className="h-3 w-3" /> Perdida
                  </Badge>
                </button>

                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-30"
                      disabled={idx === 0 || busyId === stage.id}
                      onClick={() => runAction(stage.id, () => moveStageAction({ stageId: stage.id, direction: "up" }))}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-30"
                      disabled={idx === pipeline.stages.length - 1 || busyId === stage.id}
                      onClick={() =>
                        runAction(stage.id, () => moveStageAction({ stageId: stage.id, direction: "down" }))
                      }
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded-md p-1.5 text-[var(--status-critical)] hover:bg-[var(--surface-hover)] disabled:opacity-30"
                      disabled={busyId === stage.id}
                      onClick={() => {
                        if (!window.confirm(`¿Eliminar la etapa "${stage.name}"?`)) return;
                        runAction(stage.id, () => deleteStageAction({ stageId: stage.id }));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {canManage && (
            <div className="flex items-center gap-2 border-t border-[var(--border-hairline)] px-4 py-2.5">
              <Input
                placeholder="Nombre de la nueva etapa"
                className="h-8"
                value={newStageName[pipeline.id] ?? ""}
                onChange={(e) => setNewStageName((prev) => ({ ...prev, [pipeline.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddStage(pipeline.id);
                }}
              />
              <Button size="sm" variant="secondary" onClick={() => handleAddStage(pipeline.id)}>
                <Plus className="h-4 w-4" /> Agregar etapa
              </Button>
            </div>
          )}
        </div>
      ))}

      <Modal
        open={createPipelineOpen}
        onClose={() => setCreatePipelineOpen(false)}
        title={`Nuevo pipeline de ${ENTITY_LABEL[entityTab]}`}
        description="Se crea vacío — agregale etapas después de crearlo. No reemplaza al pipeline en uso hoy en el Kanban."
      >
        <div className="space-y-3">
          <FieldWrapper label="Nombre">
            <Input
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
              placeholder='Ej. "Retención"'
            />
          </FieldWrapper>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setCreatePipelineOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreatePipeline}>
              Crear
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
