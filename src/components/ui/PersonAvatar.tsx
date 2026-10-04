"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** De quién es la foto: un usuario (User.id) o un agente (Agent.id, se usa
 * la foto del usuario vinculado a ese agente). */
export type PersonRef = { userId?: string | null; agentId?: string | null };

const PALETTE = ["#7c3aed", "#db2777", "#2563eb", "#0d9488", "#ea580c", "#16a34a", "#9333ea", "#0891b2"];

export function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return `${parts[0][0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] ?? "" : ""}`.toUpperCase();
}

function colorFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function avatarSrc(ref: PersonRef | undefined): string | null {
  if (ref?.userId) return `/api/avatar?user=${encodeURIComponent(ref.userId)}`;
  if (ref?.agentId) return `/api/avatar?agent=${encodeURIComponent(ref.agentId)}`;
  return null;
}

/**
 * Burbuja con la foto de perfil de una persona de la plataforma. Si no tiene
 * foto (o no se sabe quién es), muestra sus iniciales sobre un color estable
 * derivado del nombre.
 */
export function PersonAvatar({
  name,
  person,
  src,
  size = 24,
  className,
}: {
  name: string;
  person?: PersonRef;
  /** URL directa de la foto (si ya se tiene); tiene prioridad sobre `person`. */
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const url = src || avatarSrc(person);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  return (
    <span
      className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full", className)}
      style={{ width: size, height: size }}
      title={name}
    >
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-semibold text-white"
          style={{ backgroundColor: colorFor(name || "?"), fontSize: Math.max(9, size * 0.4) }}
        >
          {personInitials(name || "?")}
        </span>
      )}
    </span>
  );
}

/** Foto + nombre en línea (tablas, tarjetas, detalle). */
export function PersonChip({
  name,
  person,
  size = 22,
  className,
  textClassName,
}: {
  name?: string | null;
  person?: PersonRef;
  size?: number;
  className?: string;
  textClassName?: string;
}) {
  if (!name) return <span className="text-[var(--ink-muted)]">—</span>;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 align-middle", className)}>
      <PersonAvatar name={name} person={person} size={size} />
      <span className={cn("truncate", textClassName)}>{name}</span>
    </span>
  );
}
