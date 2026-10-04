"use client";

import { useEffect, useState } from "react";
import { Activity, Clock, Pause, Play, Square } from "lucide-react";
import { clockInAction, pauseAction, resumeAction, finishAction, type TimeEntryPayload } from "@/app/(app)/clock-actions";
import { cn } from "@/lib/utils";
import { useDailyReport } from "@/components/daily-report/DailyReportProvider";

/**
 * "Smart Clock" — control de jornada dentro del dropdown del perfil.
 *
 * Rediseño puramente visual: toda la lógica (estado `entry`, cronómetro en
 * vivo, acciones de servidor) es la MISMA que ya existía acá — no se creó
 * una segunda implementación ni un endpoint nuevo. El backend real ya
 * estaba resuelto desde antes (ver src/app/(app)/clock-actions.ts):
 * `clockInAction` es idempotente (si ya hay una jornada abierta la
 * devuelve en vez de duplicarla), y el `initialEntry` que recibe este
 * componente viene precargado desde el servidor en cada carga de página
 * (ver AppShell → Header → getSessionUser + query de TimeEntry activo), así
 * que un refresh COMPLETO de página (F5) reconstruye el cronómetro a partir
 * de la hora real guardada en la base de datos — nunca se reinicia solo por
 * recargar.
 *
 * Nota sobre el ciclo de vida: este componente vive dentro del dropdown del
 * perfil (Header.tsx), que ahora queda SIEMPRE montado (se oculta con CSS,
 * no se desmonta) — así que el estado `entry`/`now` de acá sobrevive a
 * cerrar y volver a abrir el menú sin depender de nada del servidor. (Antes
 * se usaba `router.refresh()` para resincronizar tras cada acción, pero eso
 * revalida TODO el árbol de server components de la página — no solo el
 * reloj — y se sentía con demora; se quitó porque, al no desmontarse más el
 * dropdown, ya no hacía falta.)
 */

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

function formatClockInTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function ClockWidget({ initialEntry }: { initialEntry: TimeEntryPayload | null }) {
  const [entry, setEntry] = useState(initialEntry);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Acceso manual al Reporte diario (null si el usuario no registra reportes).
  const dailyReport = useDailyReport();

  // Solo corre el reloj mientras está "En el trabajo" — en pausa se congela
  // en el momento en que se pausó, no sigue sumando.
  useEffect(() => {
    if (entry?.status !== "WORKING") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [entry?.status]);

  const workedSeconds = entry
    ? (() => {
        const clockInMs = new Date(entry.clockIn).getTime();
        const endMs = entry.status === "PAUSED" && entry.pausedAt ? new Date(entry.pausedAt).getTime() : now;
        return (endMs - clockInMs) / 1000 - entry.totalPausedSeconds;
      })()
    : 0;

  async function run<T extends { ok: boolean; error?: string }>(action: () => Promise<T>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) setError(result.error ?? "No se pudo completar la acción.");
    return result;
  }

  async function handleStart() {
    const result = await run(clockInAction);
    if (result.ok && "entry" in result) setEntry(result.entry);
  }
  async function handlePause() {
    if (!entry) return;
    const result = await run(() => pauseAction(entry.id));
    if (result.ok && "entry" in result) setEntry(result.entry);
  }
  async function handleResume() {
    if (!entry) return;
    const result = await run(() => resumeAction(entry.id));
    if (result.ok && "entry" in result) setEntry(result.entry);
  }
  async function handleFinish() {
    if (!entry) return;
    const result = await run(() => finishAction(entry.id));
    if (result.ok) setEntry(null);
  }

  const isWorking = entry?.status === "WORKING";
  const isPaused = entry?.status === "PAUSED";

  const statusLabel = !entry ? "Fuera de turno" : isWorking ? "Jornada activa" : "En pausa";
  const estadoLabel = !entry ? "Inactivo" : isWorking ? "Trabajando" : "En pausa";
  const entradaLabel = entry ? formatClockInTime(entry.clockIn) : "--:--";

  return (
    <div className="border-b border-[var(--border-hairline)] px-4 py-4">
      <div
        className={cn(
          "rounded-[14px] border p-4 shadow-[0_2px_8px_rgba(20,35,70,0.05)] transition-colors duration-300",
          isWorking
            ? "border-[#d8eee1] bg-gradient-to-br from-[#f3fbf7] to-[#edf8f2]"
            : isPaused
            ? "border-[#f3e6c9] bg-gradient-to-br from-[#fffaf0] to-[#fdf5e4]"
            : "border-[var(--border-hairline)] bg-gradient-to-br from-[var(--surface-card)] to-[var(--surface-sunken)]"
        )}
      >
        {/* 1. Indicador de estado */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full transition-colors duration-300",
                isWorking
                  ? "animate-kosmo-status-pulse bg-[var(--status-good)]"
                  : isPaused
                  ? "animate-kosmo-status-pulse-warning bg-[var(--status-warning)]"
                  : "bg-[#aeb6c4]"
              )}
            />
            <span className="truncate text-sm font-semibold text-[var(--ink-primary)]">{statusLabel}</span>
          </div>

          {/* Pausar/Reanudar vive acá — un control pequeño y discreto en vez
              de un botón grande, para no competir con la acción principal
              (Iniciar/Finalizar) de abajo, que es la que pidió ocupar todo
              el ancho. La función ya existía y sigue disponible, solo
              cambió dónde vive visualmente. */}
          <div className="flex shrink-0 items-center gap-0.5">
          {entry && (
            <button
              type="button"
              disabled={busy}
              onClick={isWorking ? handlePause : handleResume}
              title={isWorking ? "Pausar" : "Reanudar"}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-50",
                isWorking
                  ? "text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink-primary)]"
                  : "text-[var(--status-warning)] hover:bg-[var(--status-warning-bg)]"
              )}
            >
              {isWorking ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          )}
          {/* Reloj = acceso manual al Reporte diario. Solo abre el modal: no
              inicia, pausa ni modifica la jornada ni el contador. */}
          {dailyReport ? (
            <button
              type="button"
              onClick={dailyReport.openReport}
              aria-label="Reporte diario"
              className="group/report relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-black/5 hover:text-[var(--ink-primary)]"
            >
              <Clock className="h-3.5 w-3.5" />
              {dailyReport.hasPending && (
                <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--brand-500)] ring-2 ring-[var(--surface-card)]" />
              )}
              <span className="pointer-events-none absolute right-full top-1/2 mr-1.5 -translate-y-1/2 whitespace-nowrap rounded-md bg-[var(--ink-primary)] px-2 py-1 text-[11px] font-medium text-[var(--surface-card)] opacity-0 shadow-md transition-opacity duration-150 group-hover/report:opacity-100">
                Reporte diario
              </span>
            </button>
          ) : (
            !entry && <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" />
          )}
          </div>
        </div>

        {/* 2. Contador principal */}
        <div className="mb-4">
          <span
            className={cn(
              "block font-mono text-[34px] font-bold leading-none tracking-tight tabular-nums",
              isWorking ? "text-[#1c8c61]" : isPaused ? "text-[#a06b0e]" : "text-[var(--ink-primary)]"
            )}
          >
            {formatDuration(workedSeconds)}
          </span>
          <span className="mt-2 block text-xs font-medium text-[var(--ink-muted)]">Tiempo trabajado</span>
        </div>

        {/* 3. Botón principal — ocupa todo el ancho disponible, justo debajo
            del contador (antes que las cajitas de info) para que respire y
            no se vea todo apretado en una sola franja. */}
        {!entry ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleStart}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--brand-500)] text-sm font-semibold text-white shadow-[0_4px_10px_rgba(42,120,214,0.18)] transition-all duration-150 hover:-translate-y-px hover:bg-[var(--brand-600)] hover:shadow-[0_6px_14px_rgba(42,120,214,0.25)] disabled:pointer-events-none disabled:opacity-50"
          >
            <Play className="h-4 w-4" /> {busy ? "Iniciando..." : "Iniciar jornada"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={handleFinish}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--status-critical)] text-sm font-semibold text-white shadow-[0_4px_10px_rgba(208,59,59,0.16)] transition-all duration-150 hover:-translate-y-px hover:brightness-[1.08] hover:shadow-[0_6px_14px_rgba(208,59,59,0.22)] disabled:pointer-events-none disabled:opacity-50"
          >
            <Square className="h-4 w-4" /> {busy ? "Finalizando..." : "Finalizar jornada"}
          </button>
        )}

        {/* 4. Información secundaria — debajo del botón, con más aire */}
        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          <div className="flex items-center gap-2.5 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--surface-card)]/70 px-3 py-2.5">
            <Clock className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
            <div className="min-w-0">
              <p className="text-[11px] leading-tight text-[var(--ink-muted)]">Entrada</p>
              <p className="truncate text-sm font-semibold leading-tight text-[var(--ink-primary)]">{entradaLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--surface-card)]/70 px-3 py-2.5">
            <Activity className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
            <div className="min-w-0">
              <p className="text-[11px] leading-tight text-[var(--ink-muted)]">Estado</p>
              <p className="truncate text-sm font-semibold leading-tight text-[var(--ink-primary)]">{estadoLabel}</p>
            </div>
          </div>
        </div>

        {error && <p className="mt-2 text-[11px] text-[var(--status-critical)]">{error}</p>}
      </div>
    </div>
  );
}
