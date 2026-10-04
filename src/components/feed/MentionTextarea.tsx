"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/ui/PersonAvatar";
import { mentionToken, EVERYONE_MENTION_ID } from "@/lib/feed/mentions";
import type { FeedUserOption } from "@/types";

interface MentionOption {
  id: string;
  name: string;
  department?: string;
}

/**
 * Textarea con autocomplete de @menciones — compartido entre el compositor
 * y el campo de comentario (spec sección 6). Al escribir "@" y el
 * principio de un nombre, muestra hasta 6 coincidencias (incluido
 * "@Todos") y al elegir una inserta el token @{userId:Nombre} (ver
 * src/lib/feed/mentions.ts), que luego se resalta al renderizar con
 * FeedMentionText.
 */
export function MentionTextarea({
  value,
  onChange,
  users,
  placeholder,
  rows = 3,
  className,
  onSubmitShortcut,
  autoFocus,
  maxHeight = 480,
}: {
  value: string;
  onChange: (value: string) => void;
  users: FeedUserOption[];
  placeholder?: string;
  rows?: number;
  className?: string;
  onSubmitShortcut?: () => void;
  autoFocus?: boolean;
  /** Alto máximo (px) al crecer con el texto; pasado ese alto aparece scroll. */
  maxHeight?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // El cuadro crece con el texto (pegar o escribir varias líneas) para que
  // se vea completo, hasta maxHeight; después hace scroll por dentro.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight + 2, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight + 2 > maxHeight ? "auto" : "hidden";
  }, [value, maxHeight]);
  const [query, setQuery] = useState<string | null>(null);
  const [triggerIndex, setTriggerIndex] = useState(-1);

  const options: MentionOption[] = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    const everyone: MentionOption = { id: EVERYONE_MENTION_ID, name: "Todos" };
    const matches = [everyone, ...users].filter((o) => o.name.toLowerCase().includes(q));
    return matches.slice(0, 6);
  }, [query, users]);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);
    const cursor = e.target.selectionStart ?? next.length;
    const upToCursor = next.slice(0, cursor);
    const at = upToCursor.lastIndexOf("@");
    if (at === -1) {
      setQuery(null);
      return;
    }
    const between = upToCursor.slice(at + 1);
    if (/[\s@]/.test(between)) {
      setQuery(null);
      return;
    }
    setTriggerIndex(at);
    setQuery(between);
  }

  function selectOption(opt: MentionOption) {
    const el = ref.current;
    const cursor = el?.selectionStart ?? value.length;
    const before = value.slice(0, triggerIndex);
    const after = value.slice(cursor);
    const token = mentionToken(opt.id, opt.name);
    const next = `${before}${token} ${after}`;
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = (before + token + " ").length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (query !== null && options.length > 0 && (e.key === "Enter" || e.key === "Tab")) {
      e.preventDefault();
      selectOption(options[0]);
      return;
    }
    if (query !== null && e.key === "Escape") {
      setQuery(null);
      return;
    }
    if (onSubmitShortcut && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmitShortcut();
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        className={cn(
          "w-full resize-none rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 py-2 text-sm outline-none focus:border-[var(--brand-500)]",
          className
        )}
      />
      {query !== null && options.length > 0 && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] py-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(opt);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-hover)]"
            >
              <span className="flex min-w-0 items-center gap-2">
                {opt.id === EVERYONE_MENTION_ID ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-100)] text-[10px] font-bold text-[var(--brand-700)]">@</span>
                ) : (
                  <PersonAvatar name={opt.name} person={{ userId: opt.id }} size={20} />
                )}
                <span className="truncate font-medium text-[var(--ink-primary)]">@{opt.name}</span>
              </span>
              {opt.department && <span className="text-xs text-[var(--ink-secondary)]">{opt.department}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
