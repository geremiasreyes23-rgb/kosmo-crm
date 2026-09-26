"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Cake, Camera, Loader2, Mail, Phone, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { updateAvatarAction, updateProfileAction } from "@/app/(app)/profile/actions";

export interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
  avatarUrl: string | null;
  phone: string;
  jobTitle: string;
  birthday: string; // "yyyy-mm-dd" o ""
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;
const COVER_GRADIENT = "linear-gradient(135deg,#4d5bf9 0%,#7c3aed 55%,#a855f7 100%)";

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-sunken)] text-[var(--ink-muted)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
        {children}
      </div>
    </div>
  );
}

export function ProfileForm({ user }: { user: ProfileData }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarPreview, setAvatarPreview] = useState(user.avatarUrl);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [form, setForm] = useState({ phone: user.phone, jobTitle: user.jobTitle, birthday: user.birthday });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

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
    setAvatarPreview(dataUrl); // vista previa optimista mientras se sube
    setAvatarBusy(true);
    const result = await updateAvatarAction(dataUrl);
    setAvatarBusy(false);

    if (!result.ok) {
      setAvatarError(result.error);
      setAvatarPreview(previous);
      return;
    }
    router.refresh(); // así el avatar del Header también se actualiza
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    setSaved(false);
    const result = await updateProfileAction(form);
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] shadow-sm">
        {/* Portada + identidad */}
        <div className="relative h-28 sm:h-32" style={{ background: COVER_GRADIENT }}>
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse 70% 100% at 30% 0%, rgba(255,255,255,0.18), transparent 60%)" }}
          />
        </div>
        <div className="px-6 pb-6">
          <div className="-mt-12 flex items-end gap-4 sm:-mt-14">
            <div className="relative shrink-0">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt=""
                  className="h-24 w-24 rounded-full object-cover ring-4 ring-[var(--surface-card)] sm:h-28 sm:w-28"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--brand-100)] text-2xl font-semibold text-[var(--brand-700)] ring-4 ring-[var(--surface-card)] sm:h-28 sm:w-28">
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
                title="Cambiar foto"
                className="absolute bottom-0.5 right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--surface-card)] bg-[var(--brand-500)] text-white shadow-sm transition-colors hover:bg-[var(--brand-600)] disabled:opacity-50"
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
            <div className="min-w-0 pb-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-semibold text-[var(--ink-primary)]">
                  {user.firstName} {user.lastName}
                </h1>
                <Badge status="info">{user.roleName}</Badge>
              </div>
              <p className="mt-0.5 truncate text-sm text-[var(--ink-muted)]">{user.email}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--ink-muted)]">JPG, PNG o WEBP — máx. 1.5 MB</p>
          {avatarError && <p className="mt-1 text-xs text-[var(--status-critical)]">{avatarError}</p>}
        </div>
      </div>

      {/* Información de contacto */}
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] shadow-sm">
        <div className="border-b border-[var(--border-hairline)] px-5 py-3.5">
          <h2 className="text-sm font-semibold text-[var(--ink-primary)]">Información de contacto</h2>
        </div>
        <div className="divide-y divide-[var(--border-hairline)]">
          <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Cargo / puesto">
            <input
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              placeholder="Ej. Especialista en atención al cliente"
              className="w-full bg-transparent text-sm font-medium text-[var(--ink-primary)] outline-none placeholder:font-normal placeholder:text-[var(--ink-muted)]"
            />
          </InfoRow>
          <InfoRow icon={<Phone className="h-4 w-4" />} label="Teléfono">
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Ej. 809-555-0100"
              className="w-full bg-transparent text-sm font-medium text-[var(--ink-primary)] outline-none placeholder:font-normal placeholder:text-[var(--ink-muted)]"
            />
          </InfoRow>
          <InfoRow icon={<Cake className="h-4 w-4" />} label="Fecha de cumpleaños">
            <input
              type="date"
              value={form.birthday}
              onChange={(e) => setForm({ ...form, birthday: e.target.value })}
              className="w-full bg-transparent text-sm font-medium text-[var(--ink-primary)] outline-none [color-scheme:dark]"
            />
          </InfoRow>
          <InfoRow icon={<Mail className="h-4 w-4" />} label="Correo">
            <p className="truncate text-sm font-medium text-[var(--ink-primary)]">{user.email}</p>
          </InfoRow>
          <InfoRow icon={<ShieldCheck className="h-4 w-4" />} label="Rol">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-[var(--ink-primary)]">{user.roleName}</p>
              <span className="text-xs text-[var(--ink-muted)]">— lo administra tu Admin</span>
            </div>
          </InfoRow>
        </div>
        <div className="flex items-center gap-3 border-t border-[var(--border-hairline)] px-5 py-3.5">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
          {saved && <span className="text-xs text-[var(--status-good)]">Guardado.</span>}
          {formError && <span className="text-xs text-[var(--status-critical)]">{formError}</span>}
        </div>
      </div>
    </div>
  );
}
