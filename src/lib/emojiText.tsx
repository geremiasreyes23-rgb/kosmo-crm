import type { ReactNode } from "react";
import { Emoji } from "@/components/messenger/Emoji";

// Detecta si un grafema (ya agrupado por Intl.Segmenter, así que una
// secuencia ZWJ como "👨‍👩‍👧" o una bandera como "🇻🇪" cuentan como una sola
// unidad) es un emoji. \p{Extended_Pictographic} cubre caras/objetos/etc.;
// \p{Regional_Indicator} cubre las letras que forman banderas de país.
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/**
 * Divide un texto en fragmentos de texto plano y emojis individuales, y
 * devuelve nodos React listos para renderizar — el texto plano tal cual, y
 * cada emoji con <Emoji> (estilo Apple/iOS, consistente en todo el chat).
 *
 * Usa Intl.Segmenter (disponible en todos los navegadores/Node modernos)
 * para no partir a la mitad emojis compuestos por varios code points
 * (banderas, familias, tonos de piel). Si por algún motivo no está
 * disponible, se degrada a devolver el texto tal cual, sin emojis "apple".
 */
export function renderTextWithEmoji(text: string, keyPrefix: string): ReactNode[] {
  if (typeof Intl === "undefined" || typeof Intl.Segmenter === "undefined") {
    return [<span key={keyPrefix}>{text}</span>];
  }

  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const nodes: ReactNode[] = [];
  let buffer = "";
  let idx = 0;

  function flushBuffer() {
    if (buffer) {
      nodes.push(<span key={`${keyPrefix}-t${idx++}`}>{buffer}</span>);
      buffer = "";
    }
  }

  for (const { segment } of segmenter.segment(text)) {
    if (EMOJI_RE.test(segment)) {
      flushBuffer();
      nodes.push(<Emoji key={`${keyPrefix}-e${idx++}`} native={segment} size="1.15em" />);
    } else {
      buffer += segment;
    }
  }
  flushBuffer();

  return nodes;
}
