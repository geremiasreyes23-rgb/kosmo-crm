import { clsx, type ClassValue } from "clsx";

/** Combina clases condicionalmente. Wrapper delgado sobre clsx para mantener
 * un único punto de entrada si más adelante se agrega tailwind-merge. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** ID visible de cliente, asignado por el sistema (Client.clientNumber,
 * autoincremental de Postgres) — nunca se captura a mano. Formato fijo de 6
 * dígitos con ceros a la izquierda, ej. "C-000123". */
export function formatClientCode(clientNumber: number): string {
  return `C-${String(clientNumber).padStart(6, "0")}`;
}

/** Formatea un valor monetario en USD. */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Formatea una fecha ISO a formato corto legible. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Calcula edad exacta a partir de una fecha de nacimiento (ISO). */
export function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Calcula tiempo en cartera (años, meses, días) desde una fecha ISO. */
export function timeSince(iso: string): string {
  const start = new Date(iso);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const parts = [];
  if (years > 0) parts.push(`${years}a`);
  if (months > 0) parts.push(`${months}m`);
  parts.push(`${days}d`);
  return parts.join(" ");
}

/** Calcula iniciales (máx. 2 letras) a partir de un nombre completo. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Formatea una hora ISO en formato corto (ej. "10:42 a. m."). */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", { hour: "numeric", minute: "2-digit" }).format(
    new Date(iso)
  );
}

/** Etiqueta relativa de fecha para separadores de chat: Hoy / Ayer / fecha corta. */
export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Hoy";
  if (sameDay(date, yesterday)) return "Ayer";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/** Enmascara un identificador sensible dejando visibles solo los últimos N caracteres. */
export function maskSensitive(value: string, visible = 4): string {
  if (!value) return "";
  const clean = value.replace(/\s/g, "");
  if (clean.length <= visible) return "*".repeat(clean.length);
  return `${"*".repeat(clean.length - visible)}${clean.slice(-visible)}`;
}

/** Etiqueta relativa tipo "Hace 3 días" / "Justo ahora" a partir de una fecha
 * ISO — usada en el perfil (estado, actividad reciente) donde una fecha
 * exacta importa menos que "qué tan reciente fue esto". */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec < 30) return "Justo ahora";
  if (diffSec < 60) return "Hace unos segundos";

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} ${diffMin === 1 ? "minuto" : "minutos"}`;

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `Hace ${diffDays} ${diffDays === 1 ? "día" : "días"}`;

  const diffWeeks = Math.round(diffDays / 7);
  if (diffWeeks < 5) return `Hace ${diffWeeks} ${diffWeeks === 1 ? "semana" : "semanas"}`;

  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) return `Hace ${diffMonths} ${diffMonths === 1 ? "mes" : "meses"}`;

  const diffYears = Math.round(diffDays / 365);
  return `Hace ${diffYears} ${diffYears === 1 ? "año" : "años"}`;
}

// Paleta de marca — mismos tonos usados en el resto del CRM (badges de
// reconocimientos, degradados de perfil, etc.), para que el color de avatar
// de cada usuario real del chat combine con el resto de la UI.
const AVATAR_COLOR_PALETTE = [
  "#3987e5", // brand
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#4a3aa7",
  "#e87ba4",
  "#20b6ac",
  "#a855f7",
];

/** Color de avatar determinístico a partir de un id — el mismo usuario
 * siempre obtiene el mismo color sin necesidad de guardarlo en la base de
 * datos (útil para el chat, donde cada usuario real necesita un color de
 * iniciales estable). */
export function avatarColorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLOR_PALETTE[hash % AVATAR_COLOR_PALETTE.length];
}

/** Días restantes (o transcurridos, negativo) hasta una fecha ISO. */
export function daysUntil(iso: string): number {
  const target = new Date(iso);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
