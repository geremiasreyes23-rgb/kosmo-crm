"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarClock, ClipboardList, Clock, Save, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifyToast } from "@/components/notifications/ToastNotificationProvider";
import { OVERLAY_MAX_HEIGHT, OVERLAY_TOP_CLASSES, OverlayPortal, useScrollLock } from "@/components/ui/Overlay";
import {
  getDailyReportModalStateAction,
  saveDailyReportDraftAction,
  submitDailyReportFromModalAction,
} from "@/app/(app)/activities/daily-report-modal-actions";

/**
 * Reporte diario — UN solo componente con dos formas de abrirse:
 *
 *  1. Recordatorio automático: a partir de REMINDER_HOUR (hora local), de
 *     lunes a viernes, si el usuario todavía no envió su reporte de hoy.
 *     "Recordarme en 1 hora" (o cerrar el modal) lo pospone 1 hora. Una vez
 *     enviado, no vuelve a aparecer ese día.
 *  2. Acceso manual: el reloj de la tarjeta de jornada (ClockWidget) llama a
 *     openReport() — no depende del temporizador ni toca la jornada.
 *
 * "Guardar" guarda un borrador en la base de datos (DailyReportDraft, uno
 * por día) que se recupera al volver a abrir el modal, desde cualquier
 * dispositivo. "Enviar al supervisor" crea el DailyReport real y borra el
 * borrador.
 */

/** Hora local (0–23) desde la que aparece el recordatorio automático. */
const REMINDER_HOUR = 16;
/** Días con recordatorio automático (0 = domingo … 6 = sábado). */
const REMINDER_DAYS = [1, 2, 3, 4, 5];
const SNOOZE_MS = 60 * 60 * 1000;
const MAX_LENGTH = 2000;

interface DailyReportContextValue {
  /** Abre el modal manualmente (botón de reloj). */
  openReport: () => void;
  /** Hay borrador guardado o el reporte de hoy está pendiente. */
  hasPending: boolean;
}

const DailyReportContext = createContext<DailyReportContextValue | null>(null);

/** null si el usuario no puede registrar reportes (o fuera del provider). */
export function useDailyReport(): DailyReportContextValue | null {
  return useContext(DailyReportContext);
}

function localDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dayStartIso(d = new Date()): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

type Snooze = { day: string; until: number };

export function DailyReportProvider({
  userId,
  enabled,
  children,
}: {
  userId: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const { notify } = useNotifyToast();
  const snoozeKey = `kosmo.dailyReport.snooze.${userId}`;

  const [day, setDay] = useState(() => localDay());
  const [loaded, setLoaded] = useState(false);
  const [sentToday, setSentToday] = useState(false);
  const [savedDraft, setSavedDraft] = useState("");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"auto" | "manual">("manual");
  const [busy, setBusy] = useState<"save" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const textRef = useRef<HTMLTextAreaElement>(null);

  const readSnooze = useCallback((): Snooze | null => {
    try {
      const raw = window.localStorage.getItem(snoozeKey);
      if (!raw) return null;
      const s = JSON.parse(raw) as Snooze;
      return s && s.day === localDay() && typeof s.until === "number" ? s : null;
    } catch {
      return null;
    }
  }, [snoozeKey]);

  const writeSnooze = useCallback(
    (until: number | null) => {
      try {
        if (until == null) window.localStorage.removeItem(snoozeKey);
        else window.localStorage.setItem(snoozeKey, JSON.stringify({ day: localDay(), until }));
      } catch {
        // Sin almacenamiento local: el recordatorio vuelve en el próximo chequeo.
      }
    },
    [snoozeKey]
  );

  // Estado del día (borrador + ¿ya se envió?) — al cargar y al cambiar de día.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoaded(false);
    getDailyReportModalStateAction(day, dayStartIso())
      .then((s) => {
        if (cancelled) return;
        setSentToday(s.sentToday);
        setSavedDraft(s.draft);
        setText((cur) => (cur.trim() ? cur : s.draft));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, day]);

  // Reloj interno (cada 30 s) para el recordatorio y el cambio de día.
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      setNow(Date.now());
      const today = localDay();
      setDay((d) => (d === today ? d : today));
    }, 30_000);
    return () => clearInterval(id);
  }, [enabled]);

  /** ¿Toca mostrar el recordatorio automático en este momento? */
  const isDue = useCallback(
    (at: number) => {
      if (!enabled || !loaded || sentToday) return false;
      const snooze = readSnooze();
      if (snooze) return at >= snooze.until;
      const d = new Date(at);
      return REMINDER_DAYS.includes(d.getDay()) && d.getHours() >= REMINDER_HOUR;
    },
    [enabled, loaded, sentToday, readSnooze]
  );

  // Recordatorio automático.
  useEffect(() => {
    if (open || !isDue(now)) return;
    setSource("auto");
    setError(null);
    setText((cur) => (cur.trim() ? cur : savedDraft));
    setOpen(true);
  }, [now, open, isDue, savedDraft]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => textRef.current?.focus());
  }, [open]);

  const openReport = useCallback(() => {
    setSource("manual");
    setError(null);
    setText((cur) => (cur.trim() ? cur : savedDraft));
    setOpen(true);
  }, [savedDraft]);

  /** Cerrar sin enviar: si el recordatorio ya estaba vigente, vuelve en 1 h. */
  const close = useCallback(() => {
    if (busy) return;
    if (isDue(Date.now()) || readSnooze()) writeSnooze(Date.now() + SNOOZE_MS);
    setOpen(false);
  }, [busy, isDue, readSnooze, writeSnooze]);

  function remindLater() {
    writeSnooze(Date.now() + SNOOZE_MS);
    setOpen(false);
  }

  async function save() {
    setBusy("save");
    setError(null);
    const r = await saveDailyReportDraftAction(day, text);
    setBusy(null);
    if (!r.ok) {
      setError(r.error ?? "No se pudo guardar el borrador.");
      return;
    }
    setSavedDraft(text.trim() ? text.slice(0, MAX_LENGTH) : "");
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
    if (isDue(Date.now()) || readSnooze()) writeSnooze(Date.now() + SNOOZE_MS);
  }

  async function send() {
    if (!text.trim()) {
      setError("Escribe tu reporte antes de enviarlo.");
      textRef.current?.focus();
      return;
    }
    setBusy("send");
    setError(null);
    const r = await submitDailyReportFromModalAction(day, text);
    setBusy(null);
    if (!r.ok) {
      setError(r.error ?? "No se pudo enviar el reporte.");
      return;
    }
    setSentToday(true);
    setSavedDraft("");
    setText("");
    writeSnooze(null);
    setOpen(false);
    notify({
      type: "daily_report_submitted",
      title: "✓ Reporte enviado",
      message: "Tu reporte diario fue enviado al supervisor.",
    });
    router.refresh();
  }

  useScrollLock(enabled && open);

  // Escape cierra (igual que la X).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const hasPending = useMemo(() => {
    if (!enabled || !loaded || sentToday) return false;
    if (savedDraft.trim()) return true;
    const d = new Date(now);
    return !!readSnooze() || (REMINDER_DAYS.includes(d.getDay()) && d.getHours() >= REMINDER_HOUR);
  }, [enabled, loaded, sentToday, savedDraft, now, readSnooze]);

  const value = useMemo(() => (enabled ? { openReport, hasPending } : null), [enabled, openReport, hasPending]);

  return (
    <DailyReportContext.Provider value={value}>
      {children}
      {enabled && open && (
        <OverlayPortal>
        <div
          className={`animate-kosmo-fade-in z-[60] bg-black/45 backdrop-blur-[2px] ${OVERLAY_TOP_CLASSES}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-report-title"
            className={`animate-kosmo-fade-in-scale flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--surface-card)] shadow-2xl ${OVERLAY_MAX_HEIGHT}`}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-hairline)] px-8 py-6">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--brand-50)] text-[var(--brand-600)]">
                  <ClipboardList className="h-6 w-6" />
                </span>
                <div>
                  <h2 id="daily-report-title" className="text-xl font-semibold text-[var(--ink-primary)]">
                    Reporte diario
                  </h2>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">No olvides registrar tus actividades del día.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-8 py-7">
              <div className="flex items-start gap-3.5 rounded-xl border border-[var(--brand-100)] bg-[var(--brand-50)] px-5 py-4 text-sm leading-relaxed text-[var(--ink-secondary)]">
                <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-600)]" />
                <p>
                  Es importante mantener tu reporte actualizado.
                  <br />
                  Puedes registrarlo ahora o recordármelo más tarde.
                </p>
              </div>

              <div>
                <textarea
                  ref={textRef}
                  value={text}
                  maxLength={MAX_LENGTH}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Escribe aquí tu reporte del día..."
                  rows={10}
                  className={cn(
                    "min-h-[240px] w-full resize-y rounded-xl border bg-[var(--surface-card)] px-4 py-3.5 text-sm leading-relaxed outline-none transition-shadow focus:border-[var(--brand-500)] focus:ring-4 focus:ring-[var(--brand-500)]/10",
                    error ? "border-[var(--status-critical)]" : "border-[var(--border-hairline)]"
                  )}
                />
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--ink-muted)]">
                  <span>Se guardará automáticamente con la fecha y hora de envío.</span>
                  <span className={cn("tabular-nums", text.length >= MAX_LENGTH && "text-[var(--status-critical)]")}>
                    {text.length}/{MAX_LENGTH}
                  </span>
                </div>
              </div>

              {error && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--status-critical)]">
                  <AlertCircle className="h-3.5 w-3.5" /> {error}
                </p>
              )}
              {savedFlash && !error && <p className="text-xs font-medium text-[var(--status-good)]">✓ Borrador guardado</p>}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[var(--border-hairline)] bg-[var(--surface-sunken)] px-8 py-5 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={remindLater}
                disabled={!!busy}
                className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)] disabled:opacity-50 sm:mr-auto"
              >
                <Clock className="h-4 w-4" /> Recordarme en 1 hora
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!!busy}
                className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-5 text-sm font-medium text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {busy === "save" ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={send}
                disabled={!!busy}
                className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[var(--brand-500)] px-6 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[var(--brand-600)] disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {busy === "send" ? "Enviando..." : "Enviar al supervisor"}
              </button>
            </div>
            {source === "auto" && <span className="sr-only">Recordatorio automático</span>}
          </div>
        </div>
        </OverlayPortal>
      )}
    </DailyReportContext.Provider>
  );
}
