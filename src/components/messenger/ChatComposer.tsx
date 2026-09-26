"use client";

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";
import { Image as ImageIcon, Send, Smile, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { detectMentionTrigger, type MentionUser } from "@/lib/mentions";
import { StickerPicker } from "./StickerPicker";
import { ChatAvatar } from "./ChatAvatar";
import type { ChatUser } from "@/types";

export interface ComposerAttachment {
  id: string;
  /** Data URL (base64) — así viaja embebida en el mensaje, no una blob: URL
   * local (esas solo existen en el navegador de quien las adjuntó y nunca
   * le llegarían a la otra persona). */
  url: string;
  name: string;
}

export interface ComposerSendPayload {
  text?: string;
  attachments?: ComposerAttachment[];
  sticker?: string;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export function ChatComposer({
  onSend,
  mentionUsers,
}: {
  onSend: (payload: ComposerSendPayload) => void;
  /** Directorio de la organización — candidatos para el desplegable de
   * "@" (autocompletado de menciones). Si no se pasa, las menciones
   * simplemente no se ofrecen (el texto libre sigue funcionando igual). */
  mentionUsers?: ChatUser[];
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<ComposerAttachment[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  // Cuántos dragenter "de más" recibimos (el navegador dispara uno por cada
  // elemento hijo que el cursor sobrevuela) — así sabemos cuándo el drag
  // salió de verdad del compositor y no solo pasó de un hijo a otro.
  const dragCounter = useRef(0);

  // --- Menciones ("@Nombre") -------------------------------------------
  // No hay backend de por medio: se detecta el patrón mientras se escribe
  // (ver src/lib/mentions.ts) y al elegir alguien del desplegable se
  // inserta "@Nombre Completo " como texto plano — MessageBubble reconoce
  // ese mismo patrón al mostrar el mensaje y lo vuelve clickeable.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const [activeMentionIdx, setActiveMentionIdx] = useState(0);

  const mentionCandidates: MentionUser[] = useMemo(
    () => (mentionUsers ?? []).map((u) => ({ id: u.id, name: u.name })),
    [mentionUsers]
  );

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.trim().toLowerCase();
    return mentionCandidates
      .filter((u) => u.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        return aStarts - bStarts;
      })
      .slice(0, 6);
  }, [mentionQuery, mentionCandidates]);

  function syncMentionState(target: HTMLInputElement) {
    const cursor = target.selectionStart ?? target.value.length;
    const trigger = detectMentionTrigger(target.value, cursor);
    if (trigger) {
      setMentionStart(trigger.start);
      setMentionQuery(trigger.query);
      setActiveMentionIdx(0);
    } else {
      setMentionStart(-1);
      setMentionQuery(null);
    }
  }

  function closeMentionMenu() {
    setMentionStart(-1);
    setMentionQuery(null);
  }

  function selectMention(u: MentionUser) {
    if (mentionStart < 0) return;
    const cursor = textInputRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, mentionStart);
    const after = text.slice(cursor);
    const insertion = `@${u.name} `;
    setText(`${before}${insertion}${after}`);
    closeMentionMenu();
    const nextCursor = before.length + insertion.length;
    requestAnimationFrame(() => {
      textInputRef.current?.focus();
      textInputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function processFiles(fileList: FileList | File[]) {
    // Capturamos los archivos en un array PLANO de inmediato — si en vez de
    // esto se lee `e.target.files` más adelante (por ejemplo después de
    // resetear el input), en algunos navegadores/entornos esa lectura
    // tardía puede llegar vacía porque el input ya se reseteó. Con
    // Array.from clonamos las referencias a los File ya mismo, así el
    // reseteo del input (que hacemos para poder reseleccionar el mismo
    // archivo dos veces seguidas) no puede afectar lo que ya procesamos.
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setError(null);

    const accepted: File[] = [];
    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setError("Usa una imagen JPG, PNG, WEBP o GIF.");
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError("Cada imagen debe pesar menos de 3 MB.");
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length === 0) return;

    try {
      const next = await Promise.all(
        accepted.map(
          (file) =>
            new Promise<ComposerAttachment>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  url: reader.result as string,
                  name: file.name,
                });
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            })
        )
      );
      setPending((prev) => [...prev, ...next]);
    } catch {
      // Antes, si FileReader fallaba por cualquier motivo, esto quedaba en
      // silencio total y la foto nunca aparecía sin ninguna pista de por
      // qué. Ahora siempre se ve un aviso.
      setError("No se pudo cargar la imagen. Probá con otro archivo.");
    }
  }

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const fileList = input.files;
    if (!fileList || fileList.length === 0) {
      input.value = "";
      return;
    }
    const files = Array.from(fileList);
    input.value = "";
    await processFiles(files);
  }

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounter.current += 1;
    setDragActive(true);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragActive(false);
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) {
      setError("Soltá una imagen JPG, PNG, WEBP o GIF.");
      return;
    }
    await processFiles(files);
  }

  function removePending(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && pending.length === 0) return;
    setError(null);
    closeMentionMenu();
    onSend({ text: trimmed || undefined, attachments: pending.length ? pending : undefined });
    setText("");
    setPending([]);
  }

  function handleTextChange(e: ChangeEvent<HTMLInputElement>) {
    setText(e.target.value);
    syncMentionState(e.target);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveMentionIdx((i) => (i + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveMentionIdx((i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(mentionSuggestions[activeMentionIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMentionMenu();
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSticker(emoji: string) {
    onSend({ sticker: emoji });
    setPickerOpen(false);
  }

  return (
    <div
      // El fondo (color elegido o textura por defecto) ya lo pinta el
      // contenedor padre en ChatPanel.tsx — este div queda transparente
      // encima, así comparte exactamente el mismo pixel de fondo que el
      // área de mensajes en vez de decidir su propio color por separado.
      className="relative shrink-0 px-4 pb-4 pt-2"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragActive && (
        <div className="animate-kosmo-fade-in pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--brand-500)] bg-[var(--brand-50)]/90 text-sm font-medium text-[var(--brand-600)]">
          <ImageIcon className="h-4.5 w-4.5" /> Soltá la imagen para adjuntarla
        </div>
      )}

      {/* La barra "flota" sobre el fondo del chat: ancho máximo alineado con
          los mensajes (ver ChatPanel), fondo/borde/sombra propios en vez de
          una franja completa de punta a punta como antes. */}
      <div className="relative mx-auto w-full max-w-4xl rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-2.5 shadow-lg">
        {mentionQuery !== null && mentionSuggestions.length > 0 && (
          <div className="animate-kosmo-fade-in-scale absolute bottom-full left-14 z-20 mb-2 w-64 overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] py-1 shadow-xl">
            {mentionSuggestions.map((u, idx) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectMention(u)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                  idx === activeMentionIdx ? "bg-[var(--brand-50)]" : "hover:bg-[var(--surface-hover)]"
                )}
              >
                {(() => {
                  const fullUser = mentionUsers?.find((mu) => mu.id === u.id);
                  return fullUser ? (
                    <ChatAvatar user={fullUser} size={26} />
                  ) : (
                    <span className="h-[26px] w-[26px] shrink-0 rounded-full bg-[var(--brand-100)]" />
                  );
                })()}
                <span className="min-w-0 flex-1 truncate text-[var(--ink-primary)]">{u.name}</span>
              </button>
            ))}
          </div>
        )}

        {error && <p className="mb-2 text-xs text-[var(--status-critical)]">{error}</p>}
        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((att) => (
              <div key={att.id} className="animate-kosmo-fade-in-scale relative h-16 w-16 overflow-hidden rounded-lg border border-[var(--border-hairline)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={att.url} alt={att.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePending(att.id)}
                  className="absolute right-0.5 top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-black/60 text-white transition-transform hover:scale-110"
                  aria-label="Quitar foto"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Enviar foto"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-hover)] active:scale-95"
        >
          <ImageIcon className="h-4.5 w-4.5" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            title="Stickers"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors active:scale-95",
              pickerOpen
                ? "bg-[var(--brand-50)] text-[var(--brand-600)]"
                : "text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
            )}
          >
            <Smile className="h-4.5 w-4.5" />
          </button>
          {pickerOpen && <StickerPicker onSelect={handleSticker} onClose={() => setPickerOpen(false)} />}
        </div>

        <input
          ref={textInputRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => syncMentionState(e.currentTarget)}
          onClick={(e) => syncMentionState(e.currentTarget)}
          onBlur={closeMentionMenu}
          placeholder="Escribe un mensaje... (usa @ para mencionar)"
          className="h-9 flex-1 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-sunken)] px-4 text-sm outline-none focus:border-[var(--brand-500)] focus:bg-[var(--surface-card)]"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() && pending.length === 0}
          title="Enviar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-500)] text-white transition-[transform,opacity] hover:bg-[var(--brand-600)] active:scale-90 disabled:opacity-40 disabled:active:scale-100"
        >
          <Send className="h-4 w-4" />
        </button>
        </div>
      </div>
    </div>
  );
}
