"use client";

/**
 * Sonidos de aviso — archivos de audio reales (no osciladores sintéticos),
 * ubicados en public/sounds/. Tres timbres para identificar de oído qué
 * pasó sin mirar la pantalla:
 *  - "notification" → cualquier notificación general (tareas, citas,
 *                      Turning 65, correo interno): public/sounds/notification-sound.mp3
 *  - "message"      → mensaje nuevo en una conversación que NO se está
 *                      viendo en este momento: public/sounds/message-sound.mp3
 *  - "messageActive" → mensaje nuevo en la MISMA conversación que ya se
 *                      tiene abierta en pantalla — más discreto, ya que el
 *                      usuario ya está viendo el chat:
 *                      public/sounds/message-active-chat-sound.mp3
 *
 * Quién decide cuál de "message"/"messageActive" suena es
 * MessengerProvider (es el único lugar que sabe si el usuario está mirando
 * esa conversación puntual ahora mismo) — NotificationProvider nunca
 * reproduce sonido para mensajes de Mensajería, para no duplicar el aviso
 * sonoro del mismo evento.
 */

export type SoundKind = "message" | "messageActive" | "notification";

const SOUND_FILES: Record<SoundKind, string> = {
  notification: "/sounds/notification-sound.mp3",
  message: "/sounds/message-sound.mp3",
  messageActive: "/sounds/message-active-chat-sound.mp3",
};

// Un único <audio> por timbre, reutilizado en cada reproducción (en vez de
// crear uno nuevo cada vez) — se precarga la primera vez que se necesita
// cada timbre y queda en caché en memoria para el resto de la sesión.
const audioCache = new Map<SoundKind, HTMLAudioElement>();

function getAudio(kind: SoundKind): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  let audio = audioCache.get(kind);
  if (!audio) {
    audio = new Audio(SOUND_FILES[kind]);
    audio.preload = "auto";
    audioCache.set(kind, audio);
  }
  return audio;
}

export function playSound(kind: SoundKind) {
  try {
    const audio = getAudio(kind);
    if (!audio) return;
    // Reinicia desde el principio por si el mismo sonido ya estaba sonando
    // (ej. dos mensajes seguidos muy rápido) — evita que se pisen entre sí.
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Los navegadores pueden bloquear la reproducción hasta que haya una
      // interacción del usuario con la página (autoplay policy) — en la
      // práctica ya hubo una mucho antes de que llegue la primera
      // notificación real, pero se ignora en silencio si no fue el caso.
    });
  } catch {
    // Audio no disponible por algún motivo — no es crítico (el aviso
    // visual/badge sigue funcionando igual), se ignora en silencio.
  }
}
