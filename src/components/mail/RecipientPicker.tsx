"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { MailRecipientOption } from "@/app/(app)/mail/data";

/** Chips de destinatarios + autocompletado por nombre/apellido/correo
 * interno/departamento/rol — usado para "Para" y "CC" del compositor. Nunca
 * permite escribir una dirección libre: solo se puede agregar alguien que ya
 * está en el directorio (así el bloqueo de "solo interno" empieza en la UI,
 * aunque el backend lo vuelve a verificar de todas formas). */
export function RecipientPicker({
  label,
  directory,
  selected,
  onChange,
}: {
  label: string;
  directory: MailRecipientOption[];
  selected: MailRecipientOption[];
  onChange: (next: MailRecipientOption[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const selectedIds = new Set(selected.map((s) => s.id));
    const pool = directory.filter((d) => !selectedIds.has(d.id));
    if (!q) return pool.slice(0, 8);
    return pool
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.address.toLowerCase().includes(q) ||
          (d.department ?? "").toLowerCase().includes(q) ||
          d.roleName.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, directory, selected]);

  function add(option: MailRecipientOption) {
    onChange([...selected, option]);
    setQuery("");
    setOpen(false);
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s.id !== id));
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2.5 py-1.5">
        <span className="shrink-0 text-xs font-medium text-[var(--ink-muted)]">{label}</span>
        {selected.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] py-0.5 pl-2.5 pr-1 text-xs font-medium text-[var(--ink-primary)]"
          >
            {s.name}
            <button
              type="button"
              onClick={() => remove(s.id)}
              className="rounded-full p-0.5 text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink-primary)]"
              aria-label={`Quitar ${s.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder={selected.length ? "" : "Nombre, correo interno o departamento…"}
          className="min-w-[140px] flex-1 border-none bg-transparent py-1 text-sm outline-none"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] py-1 shadow-lg">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(r)}
              className="flex w-full flex-col items-start gap-0 px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-hover)]"
            >
              <span className="font-medium">{r.name}</span>
              <span className="text-xs text-[var(--ink-muted)]">
                {r.address}
                {r.department ? ` · ${r.department}` : ""} · {r.roleName}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
