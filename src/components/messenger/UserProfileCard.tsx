"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  Briefcase,
  Building2,
  Cake,
  ChevronRight,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Pin,
  Plus,
  Search,
  X,
} from "lucide-react";
import { cn, initials, formatTime } from "@/lib/utils";
import { getUserQuickProfileAction } from "@/app/(app)/messages/actions";
import { sendRecognitionAction } from "@/app/(app)/profile/recognition-actions";
import { RECOGNITION_TYPE_CONFIG, RECOGNITION_TYPE_ORDER } from "@/components/profile/recognitionTypes";
import { isConversationMuted, setConversationMuted } from "@/lib/mutedConversations";
import type { RecognitionType } from "@prisma/client";
import type { ChatMessage, UserQuickProfileVM } from "@/types";

/**
 * Panel de información de contacto — se abre al hacer click o click derecho
 * sobre la foto/nombre de un compañero en Mensajería (encabezado del chat,
 * lista de conversaciones o una mención dentro de un mensaje). Inspirado en
 * "Información del contacto" de WhatsApp Web: un panel deslizable DENTRO
 * del contenedor del chat (nunca un modal flotante que tapa la pantalla) —
 * en escritorio el área de mensajes se angosta para hacerle lugar, en
 * celular ocupa toda la pantalla (ver el className del contenedor raíz,
 * abajo). Combina la ficha de solo lectura que ya existía (datos de
 * contacto + reconocimientos) con secciones nuevas: buscar dentro de la
 * conversación, archivos/fotos compartidas, mensajes destacados y
 * silenciar notificaciones.
 */
export function UserProfileCard({
  userId,
  onClose,
  currentUserId,
  conversationId,
  messages,
  onImageClick,
}: {
  /** null = cerrado. Se le pasa el id del usuario a mostrar. */
  userId: string | null;
  onClose: () => void;
  /** Para no ofrecer "enviar reconocimiento" cuando por algún motivo se
   * termina mostrando el propio perfil (ej. alguien se menciona a sí
   * mismo). */
  currentUserId: string;
  /** La conversación CON userId (no necesariamente la seleccionada en el
   * chat — se puede abrir este panel con clic derecho desde la lista de
   * conversaciones sin cambiar de chat activo) — de ahí salen los
   * archivos compartidos, la búsqueda y el silenciado. null si por algún
   * motivo esa conversación todavía no existe (nunca se chatearon). */
  conversationId: string | null;
  messages: ChatMessage[];
  onImageClick: (url: string) => void;
}) {
  const open = userId !== null;
  const [profile, setProfile] = useState<UserQuickProfileVM | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recognitionMenuOpen, setRecognitionMenuOpen] = useState(false);
  const [sendingType, setSendingType] = useState<RecognitionType | null>(null);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);
  const recognitionMenuRef = useRef<HTMLDivElement>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Silenciado — preferencia de este navegador (ver src/lib/mutedConversations.ts).
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    setMuted(conversationId ? isConversationMuted(conversationId) : false);
  }, [conversationId]);

  function toggleMuted() {
    if (!conversationId) return;
    const next = !muted;
    setMuted(next);
    setConversationMuted(conversationId, next);
  }

  useEffect(() => {
    // Ojo: no se limpia `profile` cuando userId pasa a null — se deja el
    // último perfil cargado visible mientras el panel termina de
    // deslizarse hacia afuera (la transición CSS del contenedor, ver
    // abajo), en vez de que el contenido desaparezca de golpe a mitad de
    // la animación.
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRecognitionMenuOpen(false);
    setSendFeedback(null);
    setSearchOpen(false);
    setSearchQuery("");
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
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

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

  /** Cierra el panel y desplaza el chat hasta ese mensaje — usado tanto por
   * un resultado de búsqueda como por "Mensajes destacados". El mensaje ya
   * está en el DOM (mismo `data-message-id` que usa el banner de fijado en
   * ChatPanel.tsx), así que no hace falta que ChatPanel exponga nada. */
  function jumpToMessage(messageId: string) {
    onClose();
    requestAnimationFrame(() => {
      document.querySelector(`[data-message-id="${messageId}"]`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

  const media = useMemo(() => {
    const items: { id: string; url: string }[] = [];
    for (const m of messages) {
      if (m.deletedAt || !m.attachments) continue;
      for (const att of m.attachments) items.push({ id: att.id, url: att.url });
    }
    return items.reverse(); // más reciente primero
  }, [messages]);

  const pinnedMessage = useMemo(() => messages.find((m) => m.pinned && !m.deletedAt) ?? null, [messages]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return messages
      .filter((m) => !m.deletedAt && m.text?.toLowerCase().includes(q))
      .slice(-30)
      .reverse();
  }, [messages, searchQuery]);

  const contactFields = profile
    ? [
        { label: "Cargo", value: profile.jobTitle, icon: Briefcase },
        { label: "Departamento", value: profile.department, icon: Building2 },
        { label: "Correo electrónico", value: profile.email, icon: Mail },
        { label: "Teléfono", value: profile.phone, icon: Phone },
        { label: "Ciudad", value: profile.city, icon: MapPin },
        { label: "Cumpleaños", value: profile.birthdayLabel, icon: Cake },
      ]
    : [];

  const canSendRecognition = !!profile && profile.id !== currentUserId;
  const hasContent = !!(profile || loading || error);

  return (
    <div
      className={cn(
        // Celular: overlay a pantalla completa DENTRO del contenedor del
        // chat (el padre en MessengerView.tsx tiene `relative`), deslizado
        // desde la derecha con translate-x. Escritorio (md+): columna real
        // dentro del mismo flex row que ConversationList/ChatPanel —
        // cancela el posicionamiento absoluto y en cambio anima su propio
        // ancho de 0 a 340px, así el área de mensajes se angosta para
        // hacerle lugar, igual que WhatsApp Web (nunca flota encima).
        "absolute inset-y-0 right-0 z-40 w-full overflow-hidden bg-[var(--surface-card)] transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "translate-x-full pointer-events-none",
        "md:static md:z-auto md:translate-x-0 md:pointer-events-auto md:border-l md:border-[var(--border-hairline)] md:transition-[width] md:duration-300 md:ease-in-out",
        open ? "md:w-[340px]" : "md:w-0 md:border-l-0"
      )}
    >
      <div className="flex h-full w-full flex-col overflow-y-auto md:w-[340px]">
        {hasContent && (
          <>
            {/* Cabecera — portada panorámica + avatar circular superpuesto,
                centrado, y debajo nombre + rol/estado. */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/50"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>

              <div
                className="h-28 w-full"
                style={
                  profile?.coverPhotoUrl
                    ? { backgroundImage: `url(${profile.coverPhotoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : { background: "linear-gradient(135deg, var(--brand-500), var(--brand-700))" }
                }
              />

              <div className="-mt-10 flex flex-col items-center px-5 pb-4">
                {loading ? (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[var(--surface-card)] bg-[var(--surface-sunken)]">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--ink-muted)]" />
                  </div>
                ) : profile?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    className="h-20 w-20 rounded-full border-4 border-[var(--surface-card)] object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[var(--surface-card)] bg-[var(--brand-100)] text-xl font-semibold text-[var(--brand-700)]">
                    {profile ? initials(profile.name) : ""}
                  </div>
                )}

                {profile && (
                  <>
                    <p className="mt-2.5 text-base font-semibold text-[var(--ink-primary)]">{profile.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          profile.status === "ONLINE" ? "bg-[var(--status-good)]" : "bg-[var(--ink-muted)]"
                        )}
                      />
                      {profile.status === "ONLINE" ? "En línea" : "Desconectado"} · {profile.roleName}
                    </p>
                  </>
                )}

                {error && <p className="mt-3 text-center text-sm text-[var(--status-critical)]">{error}</p>}
              </div>
            </div>

            {profile && (
              <div className="flex-1 px-5 pb-5">
                {/* Barra de acciones rápidas */}
                <div className="flex items-center justify-center border-y border-[var(--border-hairline)] py-1.5">
                  <button
                    type="button"
                    onClick={() => setSearchOpen((v) => !v)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg px-5 py-1.5 text-[11px] font-medium transition-colors",
                      searchOpen
                        ? "bg-[var(--brand-50)] text-[var(--brand-600)]"
                        : "text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                    )}
                  >
                    <Search className="h-4.5 w-4.5" />
                    Buscar
                  </button>
                </div>

                {searchOpen && (
                  <div className="mt-3">
                    <input
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar en la conversación..."
                      className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--ink-primary)] outline-none focus:border-[var(--brand-500)]"
                    />
                    {searchQuery.trim() && (
                      <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
                        {searchResults.length === 0 ? (
                          <p className="px-1 py-2 text-xs text-[var(--ink-muted)]">Sin resultados.</p>
                        ) : (
                          searchResults.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => jumpToMessage(m.id)}
                              className="block w-full rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
                            >
                              <p className="truncate text-xs text-[var(--ink-secondary)]">{m.text}</p>
                              <p className="mt-0.5 text-[10px] text-[var(--ink-muted)]">{formatTime(m.sentAt)}</p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Archivos, enlaces y documentos */}
                <div className="mt-4 border-t border-[var(--border-hairline)] pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-[var(--ink-primary)]">Archivos, enlaces y documentos</p>
                    {media.length > 0 && <span className="text-xs text-[var(--ink-muted)]">{media.length}</span>}
                  </div>
                  {media.length === 0 ? (
                    <p className="text-xs text-[var(--ink-muted)]">Aún no se compartieron archivos.</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                      {media.slice(0, 4).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onImageClick(item.url)}
                          className="aspect-square overflow-hidden rounded-lg transition-opacity hover:opacity-80"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Información de contacto — lista vertical con ícono a la
                    izquierda de cada dato (antes era una cuadrícula 2x5). */}
                <div className="mt-4 border-t border-[var(--border-hairline)] pt-2">
                  {contactFields.map((field) => {
                    const Icon = field.icon;
                    return (
                      <div key={field.label} className="flex items-start gap-3 py-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                            {field.label}
                          </p>
                          <p
                            className={cn(
                              "truncate text-sm",
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

                {/* Reconocimientos — igual que antes: la acción de enviar
                    ya existía en el server (recognition-actions.ts), esta
                    ficha es de donde se usa. */}
                <div className="mt-2 border-t border-[var(--border-hairline)] pt-4">
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

                {/* Opciones extra */}
                <div className="mt-2 border-t border-[var(--border-hairline)] pt-2">
                  <button
                    type="button"
                    onClick={() => pinnedMessage && jumpToMessage(pinnedMessage.id)}
                    disabled={!pinnedMessage}
                    className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left text-sm text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Pin className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
                    <span className="min-w-0 flex-1 truncate">Mensajes destacados</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleMuted}
                    className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left text-sm text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-hover)]"
                  >
                    {muted ? (
                      <BellOff className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
                    ) : (
                      <Bell className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {muted ? "Activar notificaciones" : "Silenciar notificaciones"}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
