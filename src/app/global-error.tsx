"use client";

import { useEffect } from "react";

// global-error.tsx cubre errores que ocurren en el propio root layout
// (src/app/layout.tsx) — un error.tsx normal no puede capturarlos porque
// vive DENTRO del layout que falló. Next.js exige que este archivo incluya
// sus propias etiquetas <html>/<body> ya que reemplaza el layout entero.
// Caso extremo y poco frecuente, pero recomendado por la documentación de
// Next.js para producción. No usa variables --brand-*/--ink-* de
// globals.css porque ese CSS podría no haber cargado si el layout falló.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[KOSMO] Error crítico en el layout raíz:", error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "0 1.5rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            background: "#f9f9f7",
            color: "#0b0b0b",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Ocurrió un error crítico</h1>
          <p style={{ maxWidth: "24rem", fontSize: "0.875rem", color: "#52514e" }}>
            La aplicación no pudo cargar correctamente. Intenta recargar la página.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "0.5rem",
              borderRadius: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#ffffff",
              background: "#2a78d6",
              border: "none",
              cursor: "pointer",
            }}
          >
            Recargar
          </button>
        </div>
      </body>
    </html>
  );
}
