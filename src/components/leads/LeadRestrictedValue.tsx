"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { revealLeadSensitiveFieldAction } from "@/app/(app)/leads/actions";
import type { RestrictedItem } from "@/components/leads/LeadRestrictedPanel";

/** Un valor restringido en línea (ej. SSN de un dependiente en una tabla). */
export function LeadRestrictedValue({ item, canReveal }: { item: RestrictedItem; canReveal: boolean }) {
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (value != null) return setValue(null);
    setBusy(true);
    const r = await revealLeadSensitiveFieldAction(item.id);
    setBusy(false);
    if (r.ok && r.value !== undefined) setValue(r.value);
    else window.alert(r.error ?? "No se pudo revelar el valor.");
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono">{value ?? item.maskedPreview}</span>
      {canReveal && (
        <button type="button" onClick={toggle} disabled={busy} className="text-[var(--ink-muted)] hover:text-[var(--ink-primary)] disabled:opacity-50" title={value != null ? "Ocultar" : "Ver valor real (queda registrado)"}>
          {value != null ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
    </span>
  );
}
