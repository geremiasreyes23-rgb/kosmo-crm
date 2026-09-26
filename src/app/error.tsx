"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

// Error boundary de App Router para rutas fuera del grupo (app) (login,
// change-password, preview, la raíz). Fase 15 — antes cualquier excepción
// no controlada mostraba la pantalla de error genérica de Next.js. Archivo
// nuevo, no modifica ningún módulo existente.
export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log server-side sería ideal, pero sin tocar la infraestructura de
    // logging existente nos limitamos a la consola — evita una pantalla
    // en blanco silenciosa mientras se investiga.
    console.error("[KOSMO] Error no controlado:", error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: "var(--surface-page)" }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: "var(--status-critical-bg)", color: "var(--status-critical)" }}
      >
        <AlertTriangle size={28} strokeWidth={1.75} />
      </div>
      <h1 className="text-2xl font-semibold" style={{ color: "var(--ink-primary)" }}>
        Ocurrió un error inesperado
      </h1>
      <p className="max-w-sm text-sm" style={{ color: "var(--ink-secondary)" }}>
        Algo falló al cargar esta página. Puedes intentar de nuevo; si el problema persiste,
        contacta al equipo de soporte.
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
        style={{ background: "var(--brand-500)" }}
      >
        Reintentar
      </button>
    </div>
  );
}
