"use client";

// Silenciar una conversación es una preferencia de ESTE navegador/dispositivo
// (igual que el fondo del chat, ver ChatPanel.tsx) — no un dato de servidor
// ni algo que la otra persona pueda notar: el mensaje se sigue recibiendo y
// contando como no leído igual que siempre, solo se suprime el toast/sonido
// emergente en este cliente puntual (ver MessengerProvider.tsx).
const STORAGE_KEY = "kosmo:muted-conversations";

function readSet(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeSet(set: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // localStorage no disponible (modo privado, etc.) — el cambio no
    // persiste entre sesiones, pero no rompe nada en esta.
  }
}

export function isConversationMuted(conversationId: string): boolean {
  return readSet().has(conversationId);
}

export function setConversationMuted(conversationId: string, muted: boolean): void {
  const set = readSet();
  if (muted) set.add(conversationId);
  else set.delete(conversationId);
  writeSet(set);
}
