"use client";

import { useRouter } from "next/navigation";
import { MessageCircle, Pencil, Video } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProfileAvatar } from "./ProfileAvatar";
import { initials as computeInitials } from "@/lib/utils";

const AVATAR_SIZE = 120;

/**
 * Banner + identidad del perfil. Sin foto de portada propia todavía
 * (`coverPhotoUrl` queda listo en el schema para cuando se agregue esa
 * subida, igual que el avatar) usa un degradado de marca en vez de una
 * imagen de stock — mantiene identidad propia y no depende de una imagen
 * externa que además podría no encajar con la paleta del CRM.
 */
export function ProfileHeader({
  firstName,
  lastName,
  jobTitle,
  roleName,
  avatarUrl,
  coverPhotoUrl,
  online,
  onEditProfile,
}: {
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  roleName: string;
  avatarUrl: string | null;
  coverPhotoUrl: string | null;
  online: boolean;
  onEditProfile: () => void;
}) {
  const router = useRouter();
  const fullName = `${firstName} ${lastName}`;

  return (
    <Card className="animate-kosmo-fade-in-up overflow-hidden">
      {/* Contenedor SIN overflow-hidden — el que lo tiene es el div de abajo,
          que envuelve solo el fondo/imagen. Si el avatar estuviera adentro
          de ese div recortado, la mitad de abajo se corta contra el borde
          de la portada en vez de sobresalir sobre ella (justo lo que pasaba
          antes). */}
      <div className="relative h-40 sm:h-56 md:h-64 lg:h-72">
        <div className="absolute inset-0 overflow-hidden">
          {coverPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPhotoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="relative h-full w-full overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(125deg, #0d2549 0%, #184f95 48%, #2a78d6 100%)",
                }}
              />
              <div
                className="absolute -left-16 -top-16 h-64 w-64 rounded-full opacity-40 blur-[70px]"
                style={{ background: "linear-gradient(135deg,#4a3aa7,#2a78d6)" }}
              />
              <div
                className="absolute -bottom-24 right-[-4rem] h-72 w-72 rounded-full opacity-30 blur-[80px]"
                style={{ background: "linear-gradient(135deg,#20b6ac,#2a78d6)" }}
              />
            </div>
          )}
          {/* Overlay para que el nombre/avatar sean legibles sin importar
              qué haya de fondo — pedido explícito del brief. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.05) 55%, transparent)" }}
          />
        </div>

        <button
          type="button"
          onClick={onEditProfile}
          className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-white/25 sm:right-6 sm:top-6"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar perfil
        </button>

        <div className="absolute -bottom-16 left-6 z-10 sm:left-8">
          <ProfileAvatar
            avatarUrl={avatarUrl}
            initials={computeInitials(fullName)}
            size={AVATAR_SIZE}
            online={online}
          />
        </div>
      </div>

      <div className="px-6 pb-6 pt-20 md:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-[var(--ink-primary)] sm:text-2xl">
                {fullName}
              </h1>
              <Badge status="info">{roleName}</Badge>
            </div>
            {jobTitle && <p className="mt-1 text-sm text-[var(--ink-secondary)]">{jobTitle}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="w-full sm:w-auto" onClick={() => router.push("/messages")}>
              <MessageCircle className="h-4 w-4" /> Chat
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled
              title="Videollamada (próximamente)"
              className="w-full sm:w-auto"
            >
              <Video className="h-4 w-4" /> Videollamada
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
