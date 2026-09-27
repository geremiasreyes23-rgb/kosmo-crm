"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Emoji } from "./Emoji";
import { EmojiPicker } from "./EmojiPicker";

/** Reacciones rápidas — el mismo puñado que WhatsApp/Messenger/Telegram
 * ofrecen al mantener presionado un mensaje. El botón "+" abre el selector
 * completo (EmojiPicker, ya usado en el compositor) para elegir cualquier
 * otro emoji como reacción. */
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function ReactionPicker({
  align = "start",
  onSelect,
  onClose,
}: {
  /** De qué lado cuelga el popover respecto al botón que lo abre — los
   * mensajes propios (pegados al borde derecho del panel) necesitan que
   * cuelgue hacia la izquierda para no salirse de la pantalla. */
  align?: "start" | "end";
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [fullPickerOpen, setFullPickerOpen] = useState(false);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "absolute bottom-full z-20 mb-2",
        align === "end" ? "right-0" : "left-0"
      )}
    >
      {fullPickerOpen ? (
        <EmojiPicker onSelect={onSelect} onClose={() => setFullPickerOpen(false)} />
      ) : (
        <div className="animate-kosmo-fade-in-scale flex items-center gap-0.5 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-card)] p-1 shadow-2xl">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onSelect(emoji)}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-125 hover:bg-[var(--surface-hover)] active:scale-95"
            >
              <Emoji native={emoji} size={20} />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFullPickerOpen(true)}
            title="Más emojis"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-hover)] active:scale-95"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
