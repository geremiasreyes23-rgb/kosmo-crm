"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Copy, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MessageContextMenuState {
  messageId: string;
  x: number;
  y: number;
  canEdit: boolean;
  canDelete: boolean;
  canCopy: boolean;
  pinned: boolean;
}

export function MessageContextMenu({
  state,
  onClose,
  onCopy,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  state: MessageContextMenuState;
  onClose: () => void;
  onCopy: (messageId: string) => void;
  onEdit: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onTogglePin: (messageId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // "click" (no "mousedown") para que el propio clic derecho que abrió el
    // menú no lo cierre de inmediato al soltar el botón.
    document.addEventListener("click", handlePointerDown);
    document.addEventListener("contextmenu", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handlePointerDown);
      document.removeEventListener("contextmenu", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Evita que el menú se salga de la ventana cuando se hace clic cerca del borde.
  const MENU_WIDTH = 190;
  const MENU_HEIGHT_ESTIMATE = 176;
  const left = Math.min(state.x, window.innerWidth - MENU_WIDTH - 8);
  const top = Math.min(state.y, window.innerHeight - MENU_HEIGHT_ESTIMATE - 8);

  const items: Array<{
    key: string;
    label: string;
    icon: ReactNode;
    onClick: () => void;
    danger?: boolean;
  }> = [];

  if (state.canCopy) {
    items.push({
      key: "copy",
      label: "Copiar",
      icon: <Copy className="h-3.5 w-3.5" />,
      onClick: () => onCopy(state.messageId),
    });
  }
  items.push({
    key: "pin",
    label: state.pinned ? "Desfijar" : "Fijar",
    icon: state.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />,
    onClick: () => onTogglePin(state.messageId),
  });
  if (state.canEdit) {
    items.push({
      key: "edit",
      label: "Editar",
      icon: <Pencil className="h-3.5 w-3.5" />,
      onClick: () => onEdit(state.messageId),
    });
  }
  if (state.canDelete) {
    items.push({
      key: "delete",
      label: "Eliminar",
      icon: <Trash2 className="h-3.5 w-3.5" />,
      onClick: () => onDelete(state.messageId),
      danger: true,
    });
  }

  return (
    <div
      ref={ref}
      style={{ left, top, width: MENU_WIDTH }}
      className="animate-kosmo-fade-in-scale fixed z-50 overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] py-1 shadow-xl"
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={cn(
            "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors",
            item.danger
              ? "text-[var(--status-critical)] hover:bg-[var(--status-critical)]/10"
              : "text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
