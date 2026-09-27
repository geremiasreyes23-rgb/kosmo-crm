"use client";

import { useEffect, useRef } from "react";
import { stickerCategories } from "@/data/messenger";

export function StickerPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
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
      ref={ref}
      className="animate-kosmo-fade-in-scale absolute bottom-full right-0 z-20 mb-2 w-72 origin-bottom-right rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3 shadow-2xl"
    >
      <p className="mb-2 px-0.5 text-xs font-semibold text-[var(--ink-muted)]">Stickers</p>
      <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
        {stickerCategories.map((cat) => (
          <div key={cat.label}>
            <p className="mb-1 px-0.5 text-[11px] font-medium text-[var(--ink-muted)]">{cat.label}</p>
            <div className="grid grid-cols-5 gap-1">
              {cat.stickers.map((sticker) => (
                <button
                  key={sticker}
                  type="button"
                  onClick={() => onSelect(sticker)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform hover:scale-125 hover:bg-[var(--surface-hover)] active:scale-95"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sticker} alt="" className="h-7 w-7 object-contain" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
