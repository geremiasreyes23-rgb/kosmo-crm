import { cn } from "@/lib/utils";

/**
 * Avatar circular reutilizable del perfil — foto o iniciales, borde blanco
 * grueso (para sobresalir sobre el banner), sombra suave y un indicador de
 * estado opcional. Independiente de ProfileHeader para poder reusarlo en
 * otros lugares (tarjeta de equipo, selector de supervisor, etc.) sin
 * arrastrar el resto del encabezado.
 */
export function ProfileAvatar({
  avatarUrl,
  initials,
  size = 128,
  online,
  className,
}: {
  avatarUrl: string | null;
  initials: string;
  size?: number;
  /** Si se pasa, dibuja el punto de estado (verde = en línea). Se omite el
   * punto por completo cuando es `undefined`, no cuando es `false`. */
  online?: boolean;
  className?: string;
}) {
  const dotSize = Math.max(12, Math.round(size * 0.12));

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <div
        className="h-full w-full overflow-hidden rounded-full ring-4 ring-white shadow-[0_6px_20px_rgba(11,11,11,0.18)]"
        style={{ background: "linear-gradient(135deg,#2a78d6,#4a3aa7)" }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-semibold text-white"
            style={{ fontSize: size * 0.34 }}
          >
            {initials}
          </div>
        )}
      </div>
      {online !== undefined && (
        <span
          className="absolute rounded-full ring-[3px] ring-white transition-colors duration-300"
          style={{
            width: dotSize,
            height: dotSize,
            right: size * 0.04,
            bottom: size * 0.04,
            background: online ? "var(--status-good)" : "var(--ink-muted)",
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
