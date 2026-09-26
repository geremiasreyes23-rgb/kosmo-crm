import type { PipelineStage } from "@/types";

// Paleta categórica validada (orden fijo, pares adyacentes seguros para daltonismo).
// Se usa solo para las etapas "en curso" — ganadas/perdidas usan la paleta de
// estado fija (verde/rojo) para no competir visualmente con el significado de
// éxito/fracaso.
const CATEGORICAL = [
  "#2a78d6", // azul
  "#eb6834", // naranja
  "#1baf7a", // aqua
  "#eda100", // amarillo
  "#e87ba4", // magenta
  "#008300", // verde
  "#4a3aa7", // violeta
  "#e34948", // rojo
];

export interface StageColor {
  accent: string; // color de acento (borde, punto, header)
  bg: string; // fondo suave para headers/badges
}

/** Asigna un color estable a cada etapa de un pipeline. Ganadas → verde de
 * estado, perdidas → rojo de estado, el resto rota sobre la paleta categórica
 * en el orden en que aparecen (siempre la misma asignación para las mismas
 * etapas, ya que se deriva del índice dentro del arreglo, no de un random). */
export function buildStageColorMap(stages: PipelineStage[]): Record<string, StageColor> {
  const map: Record<string, StageColor> = {};
  let categoricalIndex = 0;
  for (const stage of stages) {
    if (stage.isWon) {
      map[stage.id] = { accent: "var(--status-good)", bg: "var(--status-good-bg)" };
    } else if (stage.isLost) {
      map[stage.id] = { accent: "var(--status-critical)", bg: "var(--status-critical-bg)" };
    } else {
      const hex = CATEGORICAL[categoricalIndex % CATEGORICAL.length];
      categoricalIndex++;
      map[stage.id] = { accent: hex, bg: hexToSoftBg(hex) };
    }
  }
  return map;
}

function hexToSoftBg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.10)`;
}
