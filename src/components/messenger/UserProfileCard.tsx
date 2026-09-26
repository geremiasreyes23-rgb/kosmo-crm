"use client";

import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  Building2,
  Cake,
  Globe,
  Laptop,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { getUserQuickProfileAction } from "@/app/(app)/messages/actions";
import { sendRecognitionAction } from "@/app/(app)/profile/recognition-actions";
import { RECOGNITION_TYPE_CONFIG, RECOGNITION_TYPE_ORDER } from "@/components/profile/recognitionTypes";
import type { RecognitionType } from "@prisma/client";
import type { UserQuickProfileVM } from "@/types";

/**
 * Ficha completa de un compañero — se abre al hacer click o click derecho
 * sobre su foto/nombre en Mensajería (encabezado del chat, lista de
 * conversaciones o una mención dentro de un mensaje, ver MessageBubble).
 * Muestra la misma información de contacto que "Mi perfil" (de solo
 * lectura acá) y permite enviar reconocimientos — la acción y los tipos ya
 * existían, solo no tenían desde dónde usarse (ver el comentario en
 * RecognitionCard.tsx).
 */
export function UserProfileCard({
  userId,
  onClose,
  currentUserId,
}: {
  /** null = cerrada. Se le pasa el id del usuario a mostrar. */
  userId: string | null;
  onClose: () => void;
  /** Para no ofrecer "enviar reconocimiento" cuando por algún motivo se
   * termina mostrando el propio perfil (ej. alguien se menciona a sí
   * mismo). */
  currentUserId: string;
}) {
  const [profile, setProfile] = useState<UserQuickProfileVM | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recognitionMenuOpen, setRecognitionMenuOpen] = useState(false);
  const [sendingType, setSendingType] = useState<RecognitionType | null>(null);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);
  const recognitionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfile(null);
    setRecognitionMenuOpen(false);
    setSendFeedback(null);
    getUserQuickProfileAction(userId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setProfile(result.profile);
        else setError(result.error);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el perfil.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [userId, onClose]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (recognitionMenuRef.current && !recognitionMenuRef.current.contains(e.target as Node)) {
        setRecognitionMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  async function handleSendRecognition(type: RecognitionType) {
    if (!profile || sendingType) return;
    setSendingType(type);
    setSendFeedback(null);
    const result = await sendRecognitionAction(profile.id, type);
    setSendingType(null);
    if (!result.ok) {
      setSendFeedback(result.error);
      return;
    }
    setRecognitionMenuOpen(false);
    setSendFeedback("¡Reconocimiento enviado!");
    setProfile((prev) => {
      if (!prev) return prev;
      const existing = prev.recognitionCounts.find((c) => c.type === type);
      const recognitionCounts = existing
        ? prev.recognitionCounts.map((c) => (c.type === type ? { ...c, count: c.count + 1 } : c))
        : [...prev.recognitionCounts, { type, count: 1 }];
      return { ...prev, recognitionCounts };
    });
    setTimeout(() => setSendFeedback((v) => (v === "¡Reconocimiento enviado!" ? null : v)), 2500);
  }

  if (!userId) return null;

  const contactFields = profile
    ? [
        { label: "Cargo", value: profile.jobTitle, icon: Briefcase },
        { label: "Departamento", value: profile.department, icon: Building2 },
        { label: "Supervisor", value: profile.supervisorName, icon: UserCheck },
        { label: "Cumpleaños", value: profile.birthdayLabel, icon: Cake },
        { label: "Teléfono", value: profile.phone, icon: Phone },
        { label: "Ciudad", value: profile.city, icon: MapPin },
        { label: "Correo electrónico", value: profile.email, icon: Mail },
        { label: "Idioma de notificaciones", value: profile.notificationLanguage, icon: Globe },
        { label: "Formato de trabajo", value: profile.workFormat, icon: Laptop },
        { label: "Rol del sistema", value: profile.roleName, icon: ShieldCheck },
      ]
    : [];

  const canSendRecognition = !!profile && profile.id !== currentUserId;

  return (
    <div
      className="animate-kosmo-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="animate-kosmo-fade-in-scale relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-[var(--surface-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/50"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>

        <div
          className="h-20 w-full shrink-0"
          style={
            profile?.coverPhotoUrl
              ? { backgroundImage: `url(${profile.coverPhotoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: "linear-gradient(135deg, var(--brand-500), var(--brand-700))" }
          }
        />

        <div className="px-5 pb-5">
          <div className="-mt-8 flex justify-center">
            {loading ? (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[var(--surface-card)] bg-[var(--surface-sunken)]">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--ink-muted)]" />
              </div>
            ) : profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt=""
                className="h-16 w-16 rounded-full border-4 border-[var(--surface-card)] object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[var(--surface-card)] bg-[var(--brand-100)] text-lg font-semibold text-[var(--brand-700)]">
                {profile ? initials(profile.name) : ""}
              </div>
            )}
          </div>

          {error && <p className="mt-4 text-center text-sm text-[var(--status-critical)]">{error}</p>}

          {profile && (
            <>
              <div className="mt-2 text-center">
                <p className="text-base font-semibold text-[var(--ink-primary)]">{profile.name}</p>
                <p className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-[var(--ink-muted)]">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      profile.status === "ONLINE" ? "bg-[var(--status-good)]" : "bg-[var(--ink-muted)]"
                    )}
                  />
                  {profile.status === "ONLINE" ? "En línea" : "Desconectado"} · {profile.roleName}
                </p>
              </div>

              {/* Información de contacto — mismos campos que "Mi perfil"
                  (ContactInformationCard), pero condensados para una tarjeta
                  modal en vez de la página completa. */}
              <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border-hairline)]">
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  {contactFields.map((field, i) => {
                    const Icon = field.icon;
                    return (
                      <div
                        key={field.label}
                        className={cn(
                          "flex items-start gap-2.5 border-b border-[var(--border-hairline)] px-3.5 py-2.5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0",
                          i % 2 === 0 ? "sm:border-r" : ""
                        )}
                      >
                        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                            {field.label}
                          </p>
                          <p
                            className={cn(
                              "truncate text-xs",
                              field.value ? "font-medium text-[var(--ink-primary)]" : "text-[var(--ink-muted)]"
                            )}
                          >
                            {field.value || "No especificado"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reconocimientos — la acción de enviar ya existía en el
                  server (recognition-actions.ts) para cuando hubiera desde
                  dónde usarla; esta ficha es ese lugar. */}
              <div className="mt-4 border-t border-[var(--border-hairline)] pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--ink-primary)]">Reconocimientos</p>
                  {canSendRecognition && (
                    <div className="relative" ref={recognitionMenuRef}>
                      <button
                        type="button"
                        onClick={() => setRecognitionMenuOpen((v) => !v)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--brand-500)] transition-colors hover:bg-[var(--brand-50)] hover:text-[var(--brand-600)]"
                      >
                        <Plus className="h-3.5 w-3.5" /> Enviar
                      </button>
                      {recognitionMenuOpen && (
                        <div className="animate-kosmo-fade-in-scale absolute right-0 top-full z-20 mt-1.5 grid w-56 grid-cols-4 gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-2 shadow-xl">
                          {RECOGNITION_TYPE_ORDER.map((type) => {
                            const config = RECOGNITION_TYPE_CONFIG[type];
                            const Icon = config.icon;
                            const isSending = sendingType === type;
                            return (
                              <button
                                key={type}
                                type="button"
                                title={config.label}
                                disabled={sendingType !== null}
                                onClick={() => handleSendRecognition(type)}
                                className="flex flex-col items-center gap-1 rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isSending ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-[var(--ink-muted)]" />
                                ) : (
                                  <Icon className="h-4 w-4" style={{ color: config.color }} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {sendFeedback && (
                  <p
                    className={cn(
                      "mb-2 text-xs",
                      sendFeedback === "¡Reconocimiento enviado!"
                        ? "text-[var(--status-good)]"
                        : "text-[var(--status-critical)]"
                    )}
                  >
                    {sendFeedback}
                  </p>
                )}

                {profile.recognitionCounts.length === 0 ? (
                  <p className="text-xs text-[var(--ink-muted)]">Aún no tiene reconocimientos.</p>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {profile.recognitionCounts.map(({ type, count }) => {
                      const config = RECOGNITION_TYPE_CONFIG[type as RecognitionType];
                      if (!config) return null;
                      const Icon = config.icon;
                      return (
                        <div key={type} className="group relative" title={config.label}>
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-full"
                            style={{ background: `${config.color}1a`, color: config.color }}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          {count > 1 && (
                            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--surface-card)] px-1 text-[9px] font-semibold text-[var(--ink-secondary)] shadow-sm ring-1 ring-[var(--border-hairline)]">
                              {count}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
