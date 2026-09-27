"use client";

import { useEffect, useRef } from "react";
import { Picker } from "emoji-mart";
// Dataset completo del set "apple" (categorías, nombres, keywords para el
// buscador, posiciones en la hoja) y las traducciones de la UI del picker
// — ambos YA vienen empaquetados dentro de @emoji-mart/data (que ya es una
// dependencia del proyecto), así que se importan directo de ahí en vez de
// pedirlos a un CDN en tiempo real (que es lo que hace la librería por
// defecto, y resultó nada confiable — ver Emoji.tsx).
import appleData from "@emoji-mart/data/sets/15/apple.json";
import esI18n from "@emoji-mart/data/i18n/es.json";

const LOCAL_SPRITESHEET_URL = "/emoji/apple-sheet-64.png";

/**
 * Selector de emojis completo (todo el set estándar de Unicode, por
 * categorías, con búsqueda) — distinto del StickerPicker existente, que
 * solo ofrece un puñado de emojis grandes para enviar como "sticker"
 * independiente. Este inserta el emoji elegido dentro del texto que se
 * está escribiendo.
 *
 * Se monta de forma imperativa (new Picker({...}) + appendChild) en vez de
 * como JSX declarativo: así lo documenta la librería para usarla sin el
 * paquete @emoji-mart/react (que todavía no declara compatibilidad con
 * React 19 en su package.json y rompería `npm install`/`npm ci` en el
 * deploy de Railway).
 */
export function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (native: string) => void;
  onClose: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) return;

    const picker = new Picker({
      data: appleData,
      i18n: esI18n,
      locale: "es",
      set: "apple",
      emojiVersion: 15,
      getSpritesheetURL: () => LOCAL_SPRITESHEET_URL,
      theme: "light",
      previewPosition: "none",
      skinTonePosition: "search",
      perLine: 8,
      maxFrequentRows: 2,
      onEmojiSelect: (emoji: { native: string }) => onSelectRef.current(emoji.native),
    });
    mountNode.appendChild(picker as unknown as Node);

    return () => {
      if (mountNode.contains(picker as unknown as Node)) {
        mountNode.removeChild(picker as unknown as Node);
      }
    };
  }, []);

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
      className="animate-kosmo-fade-in-scale absolute bottom-full left-0 z-20 mb-2 origin-bottom-left overflow-hidden rounded-xl border border-[var(--border-hairline)] shadow-2xl"
    >
      <div ref={mountRef} />
    </div>
  );
}
