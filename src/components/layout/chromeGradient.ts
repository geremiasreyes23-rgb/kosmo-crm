import type { CSSProperties } from "react";

/**
 * Degradado morado → negro compartido por el Sidebar y el Header — antes
 * eran dos fondos independientes (el sidebar tenía su propio degradado +
 * estrellas animadas, el header era una barra blanca lisa), así que se
 * veían como dos piezas separadas en vez de un solo panel.
 *
 * La clave para que combinen sin costura visible en la esquina donde se
 * tocan es `backgroundAttachment: "fixed"`: con eso el degradado se pinta
 * en coordenadas del VIEWPORT, no de la caja de cada elemento — así que
 * aunque Sidebar y Header sean elementos DOM distintos, el color en el
 * punto exacto donde se tocan es idéntico en ambos, como si fuera un único
 * fondo continuo detrás de los dos.
 */
export const CHROME_GRADIENT_STYLE: CSSProperties = {
  backgroundImage:
    "linear-gradient(160deg, #3b2172 0%, #241454 22%, #140b34 45%, #0a0618 68%, #05040c 100%)",
  backgroundAttachment: "fixed",
  backgroundColor: "#05040c",
};
