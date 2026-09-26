"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import type { PipelineStage } from "@/types";
import { buildStageColorMap } from "@/lib/pipelineColors";
import { cn, formatCurrency } from "@/lib/utils";

/**
 * Tablero Kanban con drag & drop real (HTML5 DnD nativo, sin dependencias
 * externas). Las columnas se colorean por etapa (verde = ganada, rojo =
 * perdida, resto = paleta categórica) al estilo de un pipeline visual tipo
 * Bitrix24. Incluye micro-interacciones: elevación al pasar el mouse,
 * realce de la columna destino mientras se arrastra, una pequeña animación
 * de "asentado" cuando la tarjeta cae en su nueva etapa, y aparición
 * escalonada de las tarjetas al cargar el tablero.
 *
 * `getAmount`, si se pasa, hace que cada columna muestre el total en
 * dólares de sus tarjetas (igual que el pipeline de Bitrix24) — solo se usa
 * cuando el dato tiene un valor monetario real (ventas), nunca inventado.
 */
export function KanbanBoard<T extends { id: string }>({
  stages,
  items,
  getStageId,
  renderCard,
  onMove,
  onAddClick,
  getAmount,
}: {
  stages: PipelineStage[];
  items: T[];
  getStageId: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onMove?: (itemId: string, newStageId: string) => void;
  onAddClick?: (stageId: string) => void;
  getAmount?: (item: T) => number;
}) {
  const colors = buildStageColorMap(stages);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {stages.map((stage) => {
        const stageItems = items.filter((item) => getStageId(item) === stage.id);
        const color = colors[stage.id];
        const isDragOver = dragOverStage === stage.id;
        const total = getAmount ? stageItems.reduce((sum, item) => sum + getAmount(item), 0) : null;

        return (
          <div
            key={stage.id}
            className="w-72 shrink-0"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStage(stage.id);
            }}
            onDragLeave={() => setDragOverStage((s) => (s === stage.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              const itemId = e.dataTransfer.getData("text/plain");
              if (itemId && onMove) onMove(itemId, stage.id);
              setDragOverStage(null);
              setDraggingId(null);
              if (itemId) {
                setJustDroppedId(itemId);
                window.setTimeout(() => {
                  setJustDroppedId((cur) => (cur === itemId ? null : cur));
                }, 450);
              }
            }}
          >
            <div
              className="mb-2 overflow-hidden rounded-t-lg transition-colors"
              style={{ backgroundColor: color.bg, borderBottom: `2px solid ${color.accent}` }}
            >
              <div className="flex items-center justify-between px-2.5 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color.accent }}
                  />
                  <h3 className="truncate text-sm font-semibold text-[var(--ink-primary)]">
                    {stage.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-[var(--surface-card)] px-2 py-0.5 text-xs font-medium text-[var(--ink-secondary)] transition-transform duration-150">
                    {stageItems.length}
                  </span>
                  {onAddClick && (
                    <button
                      onClick={() => onAddClick(stage.id)}
                      className="rounded-md p-1 text-[var(--ink-secondary)] transition-[background-color,transform] duration-150 hover:scale-110 hover:bg-[var(--surface-card)] active:scale-95"
                      aria-label={`Agregar en ${stage.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {total !== null && (
                <p
                  className="px-2.5 pb-2 text-lg font-bold leading-none"
                  style={{ color: color.accent }}
                >
                  {formatCurrency(total)}
                </p>
              )}
            </div>

            <div
              className={cn(
                "flex min-h-[80px] flex-col gap-2 rounded-b-lg p-2 transition-all duration-150",
                isDragOver
                  ? "scale-[1.015] bg-[var(--brand-50)] ring-2 ring-[var(--brand-500)]/40"
                  : "bg-[var(--surface-sunken)]"
              )}
            >
              {stageItems.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", item.id);
                    setDraggingId(item.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  className={cn(
                    "animate-kosmo-fade-in-up cursor-grab transition-[opacity,transform,box-shadow] duration-150 ease-out active:cursor-grabbing",
                    "hover:-translate-y-0.5 hover:shadow-md",
                    draggingId === item.id && "scale-[0.97] opacity-40 shadow-none",
                    justDroppedId === item.id && "animate-kosmo-pop ring-2 ring-[var(--brand-500)]/50"
                  )}
                  style={{
                    borderLeft: `3px solid ${color.accent}`,
                    borderRadius: 10,
                    animationDelay: `${Math.min(index, 8) * 35}ms`,
                  }}
                >
                  {renderCard(item)}
                </div>
              ))}
              {stageItems.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-[var(--ink-muted)]">
                  Sin elementos
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
