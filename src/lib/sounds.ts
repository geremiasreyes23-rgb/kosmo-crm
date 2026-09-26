"use client";

/**
 * Sonidos de aviso — generados con Web Audio API (osciladores), no archivos
 * de audio externos. Así no dependemos de assets ni de licencias, y cada
 * sonido es trivial de ajustar (frecuencia/forma de onda/duración) desde
 * acá nomás. Tres timbres bien distintos para poder identificar de oído qué
 * pasó sin mirar la pantalla:
 *  - "message"      → mensaje nuevo en Mensajería: "pop" corto de dos notas.
 *  - "mail"          → correo interno nuevo: "ding-dong" grave, más largo.
 *  - "notification"  → cualquier otra notificación (tareas, citas, Turning
 *                       65): una sola campanada con armónico.
 *
 * Los navegadores bloquean el audio hasta que hay una interacción del
 * usuario con la página (autoplay policy) — por eso se "destraba" el
 * AudioContext en el primer click/tecla que se detecte, que en la práctica
 * ya pasó mucho antes de que llegue la primera notificación real.
 */

export type SoundKind = "message" | "mail" | "notification";

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextCtor =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!audioCtx) audioCtx = new AudioContextCtor();
  return audioCtx;
}

if (typeof window !== "undefined") {
  const unlock = () => {
    const ctx = getContext();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

function tone(
  ctx: AudioContext,
  opts: { freq: number; start: number; duration: number; type?: OscillatorType; peakGain?: number }
) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.value = opts.freq;

  const startTime = ctx.currentTime + opts.start;
  const peak = opts.peakGain ?? 0.15;
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(peak, startTime + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + opts.duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + opts.duration + 0.03);
}

export function playSound(kind: SoundKind) {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    if (kind === "message") {
      // Mensajería — dos notas cortas y ascendentes, tipo "pop" de burbuja de chat.
      tone(ctx, { freq: 880, start: 0, duration: 0.12, type: "sine", peakGain: 0.16 });
      tone(ctx, { freq: 1175, start: 0.07, duration: 0.14, type: "sine", peakGain: 0.16 });
    } else if (kind === "mail") {
      // Correo interno — "ding-dong" grave y más largo, dos notas descendentes.
      tone(ctx, { freq: 784, start: 0, duration: 0.32, type: "triangle", peakGain: 0.15 });
      tone(ctx, { freq: 523, start: 0.16, duration: 0.42, type: "triangle", peakGain: 0.15 });
    } else {
      // Notificación general — una sola campanada con un armónico suave.
      tone(ctx, { freq: 660, start: 0, duration: 0.35, type: "sine", peakGain: 0.18 });
      tone(ctx, { freq: 990, start: 0, duration: 0.3, type: "sine", peakGain: 0.07 });
    }
  } catch {
    // Web Audio no disponible o bloqueado por el navegador — no es crítico
    // (el aviso visual/badge sigue funcionando igual), se ignora en silencio.
  }
}
