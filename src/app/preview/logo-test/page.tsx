import { HolographicSphere } from "@/components/brand/HolographicSphere";
import { Starfield } from "@/components/brand/Starfield";

/**
 * Página de prueba — SOLO para comparar visualmente, no forma parte del
 * flujo real de la app (no está enlazada desde ningún menú). Muestra la
 * esfera holográfica junto al wordmark "KOSMO" en texto plano (en vez del
 * lockup SVG con las letras ilustradas que usa el login real), a menor
 * tamaño, para decidir si este tratamiento se ve mejor.
 */
export default function LogoTestPreviewPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05060f] p-8">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, #1b1440 0%, #0a0a1f 45%, #05060f 100%)",
        }}
      />
      <Starfield className="absolute inset-0" />

      <div className="relative z-10 flex flex-col items-center gap-10">
        <p className="text-xs font-medium uppercase tracking-wider text-white/40">
          Vista de prueba — solo comparación, tamaño reducido
        </p>

        <div className="flex items-center gap-3.5">
          <HolographicSphere size={64} />
          <span
            style={{
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: "#ffffff",
              lineHeight: 1,
              fontFamily: "var(--font-kosmo)",
            }}
          >
            KOSMO
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <HolographicSphere size={44} enableHover={false} />
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: "#ffffff",
              lineHeight: 1,
              fontFamily: "var(--font-kosmo)",
            }}
          >
            KOSMO
          </span>
        </div>
      </div>
    </div>
  );
}
