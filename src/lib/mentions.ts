/**
 * Menciones ("@Nombre") en Mensajería — estilo Bitrix24.
 *
 * No hay ninguna columna nueva en la base de datos: una mención es
 * simplemente el patrón "@Nombre Completo" dentro del texto plano del
 * mensaje. Al mostrar el mensaje, se compara contra el directorio de
 * usuarios (que el cliente ya tiene completo, ver MessengerProvider) para
 * reconocer qué "@algo" es en realidad una mención real y volverla un
 * elemento clickeable — así no hace falta migración ni tocar sendMessageAction.
 */

export interface MentionUser {
  id: string;
  name: string;
}

export interface MessageTextPart {
  text: string;
  userId?: string;
}

/**
 * Divide el texto de un mensaje en partes de texto plano y menciones que
 * coincidan con alguien del directorio. Compara primero por el nombre más
 * largo (para no confundir "Ana" con "Ana María") y solo cuenta como
 * mención si justo después del nombre hay un límite de palabra (espacio,
 * puntuación o fin de texto) — así "@Anabelentonces" no dispara una
 * mención a medias.
 */
export function splitMentions(text: string, users: MentionUser[]): MessageTextPart[] {
  if (!text || !text.includes("@") || users.length === 0) return [{ text }];

  const candidates = [...users]
    .filter((u) => u.name.trim().length > 0)
    .sort((a, b) => b.name.length - a.name.length);

  const parts: MessageTextPart[] = [];
  let buffer = "";
  let i = 0;

  while (i < text.length) {
    if (text[i] === "@") {
      const rest = text.slice(i + 1);
      const match = candidates.find((u) => {
        if (!rest.toLowerCase().startsWith(u.name.toLowerCase())) return false;
        const nextChar = rest[u.name.length];
        return nextChar === undefined || /[\s.,!?;:)\]]/.test(nextChar);
      });
      if (match) {
        if (buffer) {
          parts.push({ text: buffer });
          buffer = "";
        }
        parts.push({ text: `@${match.name}`, userId: match.id });
        i += 1 + match.name.length;
        continue;
      }
    }
    buffer += text[i];
    i += 1;
  }
  if (buffer) parts.push({ text: buffer });
  return parts;
}

/**
 * Detecta si el cursor está en medio de estar escribiendo una mención
 * ("@" seguido de texto sin espacio doble, empezando al inicio del texto o
 * después de un espacio) — usado por el compositor para mostrar el
 * desplegable de sugerencias mientras se escribe.
 */
export function detectMentionTrigger(
  value: string,
  cursor: number
): { start: number; query: string } | null {
  const upToCursor = value.slice(0, cursor);
  const at = upToCursor.lastIndexOf("@");
  if (at === -1) return null;

  const before = upToCursor[at - 1];
  if (before !== undefined && !/\s/.test(before)) return null; // "@" debe empezar palabra

  const query = upToCursor.slice(at + 1);
  // Un espacio simple se permite (nombres de dos palabras, ej. "Juan Pérez"),
  // pero un espacio doble o una mención demasiado larga indica que el
  // usuario ya siguió escribiendo otra cosa — se cierra el desplegable.
  if (query.includes("\n") || /\s{2,}/.test(query) || query.length > 40) return null;

  return { start: at, query };
}
