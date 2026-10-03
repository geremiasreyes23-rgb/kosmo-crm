"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { revealLeadSensitiveFieldAction } from "@/app/(app)/leads/actions";

export interface RestrictedItem {
  id: string;
  label: string;
  maskedPreview: string;
}

/** Datos restringidos de un lead: siempre enmascarados; quien tiene el
 * permiso "sensitive_data:view" puede revelar un valor puntual (queda
 * registrado en SensitiveDataAccessLog). */
export function LeadRestrictedPanel({
  title,
  items,
  canReveal,
  emptyText = "Sin datos restringidos guardados.",
}: {
  title: string;
  items: RestrictedItem[];
  canReveal: boolean;
  emptyText?: string;
}) {
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(item: RestrictedItem) {
    if (revealed[item.id]) {
      setRevealed((p) => {
        const n = { ...p };
        delete n[item.id];
        return n;
      });
      return;
    }
    setLoading(item.id);
    setError(null);
    const r = await revealLeadSensitiveFieldAction(item.id);
    setLoading(null);
    if (!r.ok || r.value === undefined) {
      setError(r.error ?? "No se pudo revelar el valor.");
      return;
    }
    setRevealed((p) => ({ ...p, [item.id]: r.value! }));
  }

  return (
    <div className="rounded-lg border border-[var(--status-serious-bg)] bg-[var(--status-serious-bg)]/25 p-3">
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--ink-muted)]">
        <Lock className="h-3.5 w-3.5 text-[var(--status-serious)]" /> {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">{emptyText}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-2 rounded-md bg-[var(--surface-card)] px-3 py-1.5 text-sm">
              <span className="text-[var(--ink-muted)]">{it.label}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono font-medium">{revealed[it.id] ?? it.maskedPreview}</span>
                {canReveal && (
                  <button
                    type="button"
                    onClick={() => toggle(it)}
                    disabled={loading === it.id}
                    title={revealed[it.id] ? "Ocultar" : "Ver valor real (queda registrado)"}
                    className="text-[var(--ink-muted)] hover:text-[var(--ink-primary)] disabled:opacity-50"
                  >
                    {revealed[it.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-[var(--status-critical)]">{error}</p>}
    </div>
  );
}
