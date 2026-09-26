import Link from "next/link";
import { Compass } from "lucide-react";

// Página 404 de App Router — Fase 15 (preparación para producción). Antes
// de esto, una URL inexistente mostraba la pantalla de error genérica de
// Next.js (sin ningún estilo de KOSMO). No toca ningún módulo existente:
// es un archivo nuevo en la convención estándar de Next (src/app/not-found.tsx).
export default function NotFound() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: "var(--surface-page)" }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: "var(--brand-50)", color: "var(--brand-600)" }}
      >
        <Compass size={28} strokeWidth={1.75} />
      </div>
      <h1 className="text-2xl font-semibold" style={{ color: "var(--ink-primary)" }}>
        Página no encontrada
      </h1>
      <p className="max-w-sm text-sm" style={{ color: "var(--ink-secondary)" }}>
        La página que buscas no existe o fue movida. Verifica el enlace o vuelve al panel principal.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
        style={{ background: "var(--brand-500)" }}
      >
        Volver al Dashboard
      </Link>
    </div>
  );
}
