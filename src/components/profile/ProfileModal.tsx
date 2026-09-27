"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Building2,
  Cake,
  Camera,
  Globe,
  Laptop,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  ShieldCheck,
  User,
  UserCheck,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { AppWindowModal } from "@/components/ui/AppWindowModal";
import { updateAvatarAction, updateCoverPhotoAction, updateProfileAction } from "@/app/(app)/profile/actions";
import { ProfileAvatar } from "./ProfileAvatar";
import { StatusCard } from "./StatusCard";
import { RecognitionCard } from "./RecognitionCard";
import { ActivityTimeline } from "./ActivityTimeline";
import { initials as computeInitials } from "@/lib/utils";
import type { ProfileViewData } from "@/app/(app)/profile/data";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;
// La portada es una imagen ancha (banner) — se le da algo más de margen que
// al avatar, mismo criterio que ya se usa en Mensajería (3 MB por foto).
const MAX_COVER_FILE_BYTES = 3 * 1024 * 1024;
const AVATAR_SIZE = 128;
// Campos ya cubiertos por otra fila editable de este mismo panel (nombre
// grande arriba, cargo/teléfono/cumpleaños editables más abajo) — no se
// repiten como fila de solo lectura.
const FIELDS_SHOWN_ELSEWHERE = new Set(["Nombre", "Apellido", "Cargo", "Fecha de nacimiento"]);

const READ_ONLY_FIELD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Departamento: Building2,
  Supervisor: UserCheck,
  "Fecha de nacimiento": Cake,
  "Teléfono interno": Phone,
  Ciudad: MapPin,
  "Idioma de las notificaciones": Globe,
  "Formato de trabajo": Laptop,
  "Correo electrónico": Mail,
  "Rol del sistema": ShieldCheck,
};

function formatBirthday(value: string): string {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-DO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function InfoRow({
  icon,
  label,
  editing,
  input,
  value,
}: {
  icon: ReactNode;
  label: string;
  editing: boolean;
  input: ReactNode;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-sunken)] text-[var(--ink-muted)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
        {editing ? (
          input
        ) : (
          <p
            className={`truncate text-sm font-medium ${value ? "text-[var(--ink-primary)]" : "text-[var(--ink-muted)]"}`}
          >
            {value || "No especificado"}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * "Mi perfil" — ventana de aplicación grande que se abre SOBRE el Dashboard
 * actual (nunca navega a otra pantalla ni cambia la URL). El Dashboard
 * sigue montado detrás, ligeramente oscurecido; este modal ocupa la mayor
 * parte de la pantalla, al estilo "perfil de empleado" de una app de
 * escritorio (banner fotográfico + avatar superpuesto + información
 * distribuida en columnas amplias), en vez de un panel angosto lateral.
 */
export function ProfileModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: ProfileViewData;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const user = data.modalUser;
  const fullName = `${user.firstName} ${user.lastName}`;

  const [avatarPreview, setAvatarPreview] = useState(user.avatarUrl);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [coverPreview, setCoverPreview] = useState(user.coverPhotoUrl);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  const savedValues = { phone: user.phone, jobTitle: user.jobTitle, birthday: user.birthday };
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(savedValues);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const readOnlyFields = data.contactFields.filter((f) => !FIELDS_SHOWN_ELSEWHERE.has(f.label));

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setAvatarError("Usa una imagen JPG, PNG o WEBP.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setAvatarError("La imagen debe pesar menos de 1.5 MB.");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const previous = avatarPreview;
    setAvatarPreview(dataUrl);
    setAvatarBusy(true);
    const result = await updateAvatarAction(dataUrl);
    setAvatarBusy(false);

    if (!result.ok) {
      setAvatarError(result.error);
      setAvatarPreview(previous);
      return;
    }
    router.refresh(); // también actualiza el avatar chico del Header
  }

  async function handleCoverFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setCoverError("Usa una imagen JPG, PNG o WEBP.");
      return;
    }
    if (file.size > MAX_COVER_FILE_BYTES) {
      setCoverError("La imagen debe pesar menos de 3 MB.");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const previous = coverPreview;
    setCoverPreview(dataUrl);
    setCoverBusy(true);
    const result = await updateCoverPhotoAction(dataUrl);
    setCoverBusy(false);

    if (!result.ok) {
      setCoverError(result.error);
      setCoverPreview(previous);
      return;
    }
    router.refresh();
  }

  function startEditing() {
    setForm(savedValues);
    setFormError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setForm(savedValues);
    setFormError(null);
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    const result = await updateProfileAction(form);
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  function goToChat() {
    onClose();
    router.push("/messages");
  }

  return (
    <AppWindowModal open={open} onClose={onClose}>
      {/* Banner — SIN overflow-hidden en el contenedor que envuelve el
          avatar: si el avatar estuviera adentro del div recortado, la mitad
          de abajo (que sobresale a propósito por debajo del banner) se
          corta contra el borde en vez de superponerse. */}
      <div className="relative">
        <div className="relative h-48 sm:h-60 lg:h-72">
          <div className="absolute inset-0 overflow-hidden">
            {coverPreview ? (
              // Portada real subida por el usuario — reemplaza el degradado
              // decorativo de acá abajo (que queda como fallback cuando
              // todavía no subió ninguna).
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <>
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(125deg, #0d2549 0%, #184f95 48%, #2a78d6 100%)" }}
                />
                <div
                  className="absolute -left-20 -top-20 h-72 w-72 rounded-full opacity-40 blur-[80px]"
                  style={{ background: "linear-gradient(135deg,#4a3aa7,#2a78d6)" }}
                />
                <div
                  className="absolute -bottom-28 right-[-5rem] h-80 w-80 rounded-full opacity-30 blur-[90px]"
                  style={{ background: "linear-gradient(135deg,#20b6ac,#2a78d6)" }}
                />
              </>
            )}
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.05) 55%, transparent)" }}
            />
          </div>

          <button
            type="button"
            onClick={() => coverFileInputRef.current?.click()}
            disabled={coverBusy}
            title="Cambiar portada"
            className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg bg-black/40 px-3 py-1.5 text-xs font-medium text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/55 disabled:opacity-60"
          >
            {coverBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            {coverPreview ? "Cambiar portada" : "Agregar portada"}
          </button>
          <input
            ref={coverFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleCoverFileChange}
          />
        </div>

        <div className="absolute -bottom-14 left-6 z-10 sm:left-10">
          <div className="relative">
            <ProfileAvatar
              avatarUrl={avatarPreview}
              initials={computeInitials(fullName)}
              size={AVATAR_SIZE}
              online={data.online}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarBusy}
              title="Cambiar foto"
              className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[var(--brand-500)] text-white shadow-sm transition-colors hover:bg-[var(--brand-600)] disabled:opacity-50"
            >
              {avatarBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </div>

      <div className="px-6 pb-10 pt-18 sm:px-10 sm:pt-20">
        {/* Identidad + acciones */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-[var(--ink-primary)] sm:text-2xl">{fullName}</h1>
              <Badge status="info">{data.roleName}</Badge>
            </div>
            {user.jobTitle && <p className="mt-1 text-sm text-[var(--ink-secondary)]">{user.jobTitle}</p>}
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
              <span
                className="inline-flex h-1.5 w-1.5 rounded-full"
                style={{ background: data.online ? "var(--status-good)" : "var(--ink-muted)" }}
              />
              {data.online ? "En línea" : `Desconectado · ${data.lastActiveLabel}`}
            </div>
            {avatarError && <p className="mt-1.5 text-xs text-[var(--status-critical)]">{avatarError}</p>}
            {coverError && <p className="mt-1.5 text-xs text-[var(--status-critical)]">{coverError}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={goToChat}>
              <MessageCircle className="h-4 w-4" /> Chat
            </Button>
            <Button size="sm" variant="secondary" disabled title="Videollamada (próximamente)">
              <Video className="h-4 w-4" /> Videollamada
            </Button>
            {!editing ? (
              <Button size="sm" variant="secondary" onClick={startEditing}>
                <Pencil className="h-4 w-4" /> Editar perfil
              </Button>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={cancelEditing} disabled={saving}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Contenido — dos columnas amplias en pantallas grandes */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="animate-kosmo-fade-in-up overflow-hidden">
              <CardHeader className="border-b border-[var(--border-hairline)]">
                <CardTitle>Información de contacto</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-1 gap-x-8 divide-y divide-[var(--border-hairline)] sm:grid-cols-2 sm:gap-y-0 sm:divide-y-0">
                  <InfoRow
                    icon={<Briefcase className="h-4 w-4" />}
                    label="Cargo / puesto"
                    editing={editing}
                    value={form.jobTitle}
                    input={
                      <input
                        value={form.jobTitle}
                        onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                        placeholder="Ej. Especialista en atención al cliente"
                        className="w-full bg-transparent text-sm font-medium text-[var(--ink-primary)] outline-none placeholder:font-normal placeholder:text-[var(--ink-muted)]"
                      />
                    }
                  />
                  <InfoRow
                    icon={<Phone className="h-4 w-4" />}
                    label="Teléfono"
                    editing={editing}
                    value={form.phone}
                    input={
                      <input
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="Ej. 809-555-0100"
                        className="w-full bg-transparent text-sm font-medium text-[var(--ink-primary)] outline-none placeholder:font-normal placeholder:text-[var(--ink-muted)]"
                      />
                    }
                  />
                  <InfoRow
                    icon={<Cake className="h-4 w-4" />}
                    label="Fecha de cumpleaños"
                    editing={editing}
                    value={formatBirthday(form.birthday)}
                    input={
                      <input
                        type="date"
                        value={form.birthday}
                        onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                        className="w-full bg-transparent text-sm font-medium text-[var(--ink-primary)] outline-none [color-scheme:dark]"
                      />
                    }
                  />
                  {readOnlyFields.map((f) => {
                    const Icon = READ_ONLY_FIELD_ICONS[f.label] ?? User;
                    return (
                      <div key={f.label} className="flex items-start gap-3 py-3.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-sunken)] text-[var(--ink-muted)]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                            {f.label}
                          </p>
                          <p
                            className={`truncate text-sm font-medium ${f.value ? "text-[var(--ink-primary)]" : "text-[var(--ink-muted)]"}`}
                          >
                            {f.value || "No especificado"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {formError && <p className="pt-3 text-xs text-[var(--status-critical)]">{formError}</p>}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <StatusCard online={data.online} lastActiveLabel={data.lastActiveLabel} />
            <RecognitionCard counts={data.recognitionCounts} />
            <ActivityTimeline items={data.activity} />
          </div>
        </div>
      </div>
    </AppWindowModal>
  );
}
