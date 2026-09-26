/**
 * Marca KOSMO — logotipo OFICIAL del producto (no de la agencia). Estos son
 * los archivos reales de marca tal como fueron entregados (public/brand/),
 * no una recreación en código: el logo ya es una marca registrada y no se
 * modifica su forma, proporciones ni tipografía bajo ningún concepto.
 *
 * "Alliance Insurance" es un tenant/workspace que corre sobre la plataforma
 * KOSMO, pensando en que más adelante KOSMO se venda a otras agencias.
 *
 * Variantes disponibles (una imagen por cada una, sin generarlas por CSS):
 *  - "white"    → fondos oscuros (login, sidebar)
 *  - "black"    → fondos claros (contenido, documentos)
 *  - "gradient" → azul→violeta, para usos destacados/hero
 *  - "fade"     → negro que se desvanece, para usos decorativos
 */

import type { CSSProperties } from "react";

const VARIANT_SRC = {
  white: "/brand/kosmo-white.png",
  black: "/brand/kosmo-black.png",
  gradient: "/brand/kosmo-gradient.png",
  fade: "/brand/kosmo-fade.png",
} as const;

// Relación de aspecto real del archivo fuente (1968×447) — se usa para
// reservar el espacio correcto y evitar saltos de layout.
const ASPECT_RATIO = 1968 / 447;

export type KosmoLogoVariant = keyof typeof VARIANT_SRC;

export function KosmoWordmark({
  variant = "white",
  height = 40,
  className,
}: {
  variant?: KosmoLogoVariant;
  height?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={VARIANT_SRC[variant]}
      alt="KOSMO"
      height={height}
      width={Math.round(height * ASPECT_RATIO)}
      style={{ height, width: "auto" }}
      className={className}
      draggable={false}
    />
  );
}

/**
 * "KOSMO" en texto plano (sin ilustración) — tratamiento aprobado por el
 * cliente para acompañar la esfera holográfica (login y sidebar). No es el
 * logotipo ilustrado registrado (ese sigue siendo `KosmoWordmark`, y sus
 * PNG de marca no se tocan); esto es simplemente el nombre en la tipografía
 * de marca (Century Gothic vía --font-kosmo-brand), en negrita. Usa una
 * variable de fuente propia, separada de --font-kosmo (que es Inter, para
 * el texto general de la interfaz) — este tratamiento es parte del logo y
 * nunca cambia junto con la tipografía del resto de la app.
 */
export function KosmoTextMark({
  fontSize = 32,
  color = "#ffffff",
  className,
  style,
}: {
  fontSize?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={className}
      style={{
        fontSize,
        fontWeight: 700,
        letterSpacing: "0.02em",
        color,
        lineHeight: 1,
        fontFamily: "var(--font-kosmo-brand)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      KOSMO
    </span>
  );
}
