/**
 * Menciones del Feed — el compositor (y el campo de comentario) insertan un
 * token de la forma @{userId:Nombre visible} cuando el usuario elige a
 * alguien del autocomplete de "@". Guardamos el body con el token embebido
 * (mismo texto que se muestra, solo que estructurado) para no depender de
 * volver a resolver nombres al leer, y para poder resaltar la mención al
 * renderizar (ver FeedMentionText.tsx).
 *
 * "@Todos" usa el id especial TODOS — no genera una fila de FeedMention por
 * usuario (sería una escritura por cada persona de la organización en cada
 * post), se resuelve aparte como "notificar a todos" en el momento de crear
 * el post/comentario.
 */

export const EVERYONE_MENTION_ID = "TODOS";

const MENTION_RE = /@\{([^:}]+):([^}]+)\}/g;

export interface ParsedMentions {
  /** ids de usuarios mencionados individualmente (sin duplicados, sin @Todos). */
  userIds: string[];
  mentionsEveryone: boolean;
}

export function extractMentions(body: string): ParsedMentions {
  const ids = new Set<string>();
  let mentionsEveryone = false;
  let match: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(body))) {
    if (match[1] === EVERYONE_MENTION_ID) mentionsEveryone = true;
    else ids.add(match[1]);
  }
  return { userIds: Array.from(ids), mentionsEveryone };
}

/** Texto plano sin los tokens de mención — usado para armar extractos
 * (notificaciones, columna de "Menciones recientes") sin volcar el markup. */
export function stripMentionTokens(body: string): string {
  return body.replace(MENTION_RE, "@$2");
}

export interface MentionSegment {
  type: "text" | "mention";
  text: string;
  userId?: string;
}

/** Parte el body en segmentos de texto plano y menciones, para que el
 * componente de render solo tenga que mapear — sin regex en el JSX. */
export function splitMentionSegments(body: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(body))) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: body.slice(lastIndex, match.index) });
    }
    segments.push({ type: "mention", text: `@${match[2]}`, userId: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) {
    segments.push({ type: "text", text: body.slice(lastIndex) });
  }
  return segments;
}

export function mentionToken(userId: string, name: string): string {
  return `@{${userId}:${name}}`;
}
