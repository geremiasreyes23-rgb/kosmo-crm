"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonAvatar, type PersonRef } from "@/components/ui/PersonAvatar";

export interface PersonOption {
  /** Valor que se guarda/filtra (normalmente el id; en algunos filtros el nombre). */
  value: string;
  label: string;
  person?: PersonRef;
  hint?: string;
}

/** Atajo: lista de agentes { id, name } → opciones con foto. */
export function agentOptions(list: { id: string; name: string }[], valueBy: "id" | "name" = "id"): PersonOption[] {
  return list.map((a) => ({ value: valueBy === "id" ? a.id : a.name, label: a.name, person: { agentId: a.id } }));
}

/** Atajo: lista de usuarios { id, name } → opciones con foto. */
export function userOptions(list: { id: string; name: string }[]): PersonOption[] {
  return list.map((u) => ({ value: u.id, label: u.name, person: { userId: u.id } }));
}

type BaseProps = {
  options: PersonOption[];
  placeholder?: string;
  /** Texto de la opción vacía ("Sin asignar", "Vendedor"...). Si se omite,
   * no hay opción vacía en la lista. */
  emptyLabel?: string;
  className?: string;
  id?: string;
  error?: boolean;
  disabled?: boolean;
  /** "pill" = redondeado completo (filtros); "field" = campo de formulario. */
  variant?: "field" | "pill";
  size?: "sm" | "md";
};

type SingleProps = BaseProps & { multiple?: false; value: string; onChange: (value: string) => void };
type MultiProps = BaseProps & { multiple: true; value: string[]; onChange: (value: string[]) => void };

/**
 * Selector de personas de la plataforma con su foto de perfil, en lugar del
 * <select> nativo (que no puede mostrar imágenes). Mismo uso que un select:
 * value + onChange. Con más de 7 opciones aparece un buscador.
 */
export function PersonSelect(props: SingleProps | MultiProps) {
  const { options, placeholder = "Selecciona...", emptyLabel, className, id, error, disabled, variant = "field", size = "md" } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selectedValues = props.multiple ? props.value : props.value ? [props.value] : [];
  const selected = options.filter((o) => selectedValues.includes(o.value));
  const searchable = options.length > 7;

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    const empty = emptyLabel !== undefined && !props.multiple && !q ? [{ value: "", label: emptyLabel } as PersonOption] : [];
    return [...empty, ...list];
  }, [options, query, emptyLabel, props.multiple]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      const idx = items.findIndex((i) => selectedValues.includes(i.value));
      setActive(idx >= 0 ? idx : 0);
      if (searchable) requestAnimationFrame(() => searchRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function choose(value: string) {
    if (props.multiple) {
      const next = props.value.includes(value) ? props.value.filter((v) => v !== value) : [...props.value, value];
      props.onChange(next);
    } else {
      props.onChange(value);
      setOpen(false);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item) choose(item.value);
    }
  }

  const avatarSize = size === "sm" ? 18 : 22;

  let display: React.ReactNode;
  if (selected.length === 0) {
    display = <span className="truncate text-[var(--ink-muted)]">{props.multiple || !emptyLabel ? placeholder : emptyLabel}</span>;
  } else if (selected.length === 1) {
    display = (
      <span className="flex min-w-0 items-center gap-2">
        <PersonAvatar name={selected[0].label} person={selected[0].person} size={avatarSize} />
        <span className="truncate">{selected[0].label}</span>
      </span>
    );
  } else {
    display = (
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex -space-x-1.5">
          {selected.slice(0, 3).map((o) => (
            <PersonAvatar key={o.value} name={o.label} person={o.person} size={avatarSize} className="ring-2 ring-[var(--surface-card)]" />
          ))}
        </span>
        <span className="truncate">{selected.length} seleccionados</span>
      </span>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative", !/(^|\s)w-/.test(className ?? "") && "w-full", className)} onKeyDown={onKeyDown}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-2 border bg-[var(--surface-card)] px-3 text-left outline-none transition-colors focus:border-[var(--brand-500)] disabled:cursor-not-allowed disabled:opacity-60",
          size === "sm" ? "h-8 text-xs" : "h-9 text-sm",
          variant === "pill" ? "rounded-full" : "rounded-lg",
          error ? "border-[var(--status-critical)]" : open ? "border-[var(--brand-500)]" : "border-[var(--border-hairline)]"
        )}
      >
        <span className="min-w-0 flex-1">{display}</span>
        <span className="flex shrink-0 items-center gap-1 text-[var(--ink-muted)]">
          {props.multiple && selected.length > 0 && (
            <span
              role="button"
              aria-label="Limpiar"
              onClick={(e) => {
                e.stopPropagation();
                props.onChange([]);
              }}
              className="rounded p-0.5 hover:text-[var(--ink-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div
          // Dentro de un <label> (FieldWrapper), un clic en la lista volvería a
          // "activar" el botón y reabriría el menú: se evita aquí.
          onClick={(e) => e.preventDefault()}
          className="animate-kosmo-fade-in absolute left-0 top-full z-50 mt-1 w-full min-w-[14rem] overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] shadow-lg"
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] px-3 py-2">
              <Search className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder="Buscar..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          )}
          <ul id={listId} role="listbox" aria-multiselectable={props.multiple || undefined} className="max-h-64 overflow-y-auto py-1">
            {items.length === 0 && <li className="px-3 py-2 text-sm text-[var(--ink-muted)]">Sin resultados</li>}
            {items.map((o, idx) => {
              const isSelected = o.value === "" ? selectedValues.length === 0 : selectedValues.includes(o.value);
              return (
                <li
                  key={o.value || "__empty"}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(o.value);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm",
                    idx === active && "bg-[var(--surface-hover)]",
                    isSelected && "font-medium text-[var(--brand-700)]"
                  )}
                >
                  {o.value === "" ? (
                    <span className="h-6 w-6 shrink-0 rounded-full border border-dashed border-[var(--border-grid)]" />
                  ) : (
                    <PersonAvatar name={o.label} person={o.person} size={24} />
                  )}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-xs text-[var(--ink-muted)]">{o.hint}</span>}
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-[var(--brand-500)]" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
