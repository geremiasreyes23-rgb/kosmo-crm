"use client";

import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";
import type { FieldDef } from "@/data/customFields";

/** Botón "+ Agregar campo" con menú desplegable — deja que el usuario
 * agregue al formulario, uno por uno, cualquier campo del catálogo de
 * campos personalizados que todavía no esté visible. Mismo patrón que
 * Bitrix24 usa en sus formularios de lead/deal. */
export function AddFieldMenu({
  catalog,
  onAdd,
}: {
  catalog: FieldDef[];
  onAdd: (field: FieldDef) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (catalog.length === 0) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-hairline)] px-3 py-1.5 text-xs font-medium text-[var(--brand-500)] transition-colors hover:bg-[var(--brand-50)]"
      >
        <Plus className="h-3.5 w-3.5" /> Agregar campo
      </button>
      {open && (
        <div className="animate-kosmo-fade-in-scale absolute left-0 z-10 mt-1.5 w-56 origin-top-left rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] py-1 shadow-lg">
          {catalog.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                onAdd(f);
                setOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
