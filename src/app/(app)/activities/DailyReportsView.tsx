"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Textarea } from "@/components/ui/Field";
import { createDailyReportAction, reviewDailyReportAction } from "./reports-actions";
import { useNotifyToast } from "@/components/notifications/ToastNotificationProvider";
import { formatTime, initials, cn } from "@/lib/utils";
import type { DailyReportVM, DailyReportStatus } from "@/types";
import {
  Send,
  Lock,
  Clock3,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Inbox,
  CalendarCheck2,
  CalendarDays,
  Check,
} from "lucide-react";

const MAX_LEN = 2000;

type RangePreset = "today" | "5d" | "7d" | "30d" | "month" | "custom";

const RANGE_LABELS: Record<RangePreset, string> = {
  today: "Hoy",
  "5d": "Últimos 5 días",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  month: "Este mes",
  custom: "Personalizado",
};

const STATUS_LABEL: Record<DailyReportStatus, string> = {
  PENDING: "En revisión",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

// Paleta sutil de variación por fila del historial (sección 6 del pedido de
// diseño: "lavanda / azul suave / rosa suave / verde suave"), deliberadamente
// separada de los colores de estado del Badge (que siguen significando
// Aprobado/En revisión/Rechazado) — acá solo distingue visualmente una fila
// de la siguiente, como en un calendario, sin volverse infantil.
const ROW_PALETTE = [
  { block: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300", accent: "bg-violet-400" },
  { block: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300", accent: "bg-sky-400" },
  { block: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300", accent: "bg-rose-400" },
  { block: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", accent: "bg-emerald-400" },
];

const IMPORTANT_ITEMS = [
  { icon: Lock, title: "Seguro", description: "Tus reportes están protegidos." },
  { icon: Clock3, title: "Automático", description: "Se guarda fecha y hora." },
  { icon: CheckCircle2, title: "Sin ediciones", description: "Solo lectura después de guardar." },
];

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function isWithinPreset(iso: string, preset: RangePreset, from: string, to: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  const today0 = startOfDay(now);

  if (preset === "today") return startOfDay(date).getTime() === today0.getTime();

  if (preset === "5d" || preset === "7d" || preset === "30d") {
    const days = preset === "5d" ? 5 : preset === "7d" ? 7 : 30;
    const cutoff = new Date(today0);
    cutoff.setDate(cutoff.getDate() - (days - 1));
    return date.getTime() >= cutoff.getTime();
  }

  if (preset === "month") {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  // custom
  if (!from && !to) return true;
  const fromD = from ? startOfDay(new Date(from)) : null;
  const toD = to ? new Date(new Date(to).setHours(23, 59, 59, 999)) : null;
  if (fromD && date < fromD) return false;
  if (toD && date > toD) return false;
  return true;
}

function dayBlockParts(iso: string) {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("es-ES", { day: "2-digit" }).format(d);
  const monthYear = new Intl.DateTimeFormat("es-ES", { month: "short", year: "numeric" }).format(d);
  const weekdayRaw = new Intl.DateTimeFormat("es-ES", { weekday: "long" }).format(d);
  return { day, monthYear, weekday: weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1) };
}

/** Selector premium del rango de fechas del historial — reemplaza el
 * `<select>` nativo por una píldora con icono + dropdown flotante, mismo
 * patrón de "click afuera para cerrar" que el menú de usuario del Header. */
function RangeFilterPill({
  preset,
  onChange,
}: {
  preset: RangePreset;
  onChange: (p: RangePreset) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-violet-100 bg-[var(--surface-card)] px-4 py-2 text-xs font-medium text-[var(--ink-secondary)] shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:border-violet-900/40"
      >
        <CalendarDays className="h-3.5 w-3.5 text-violet-600" />
        {RANGE_LABELS[preset]}
        <ChevronDown className={cn("h-3.5 w-3.5 text-[var(--ink-muted)] transition-transform duration-150", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-48 origin-top-right overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] py-1.5 shadow-xl">
          {(Object.keys(RANGE_LABELS) as RangePreset[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between px-3.5 py-2 text-left text-xs transition-colors hover:bg-violet-50 dark:hover:bg-violet-950/30",
                preset === key ? "font-semibold text-violet-600" : "text-[var(--ink-secondary)]"
              )}
            >
              {RANGE_LABELS[key]}
              {preset === key && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DailyReportsView({
  initialReports,
  currentUserId,
  canReview,
}: {
  initialReports: DailyReportVM[];
  currentUserId: string;
  canReview: boolean;
}) {
  const router = useRouter();
  const { notify } = useNotifyToast();
  const [isPending, startTransition] = useTransition();

  const [reports, setReports] = useState<DailyReportVM[]>(initialReports);
  useEffect(() => setReports(initialReports), [initialReports]);

  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const [preset, setPreset] = useState<RangePreset>("5d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [selected, setSelected] = useState<DailyReportVM | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const filtered = useMemo(
    () => reports.filter((r) => isWithinPreset(r.createdAt, preset, customFrom, customTo)),
    [reports, preset, customFrom, customTo]
  );

  async function handleSave() {
    const trimmed = content.trim();
    if (!trimmed) {
      setFormError("Escribe tu reporte antes de guardarlo.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await createDailyReportAction(trimmed);
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error ?? "No se pudo guardar el reporte.");
      return;
    }
    setContent("");
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2400);
    notify({
      type: "daily_report_submitted",
      title: "✓ Reporte guardado",
      message: "Tu reporte diario fue registrado correctamente.",
    });
    startTransition(() => router.refresh());
  }

  function openDetail(report: DailyReportVM) {
    setSelected(report);
    setRejecting(false);
    setReviewComment("");
    setReviewError(null);
  }

  function closeDetail() {
    setSelected(null);
    setRejecting(false);
    setReviewComment("");
    setReviewError(null);
  }

  async function handleApprove() {
    if (!selected) return;
    setReviewSubmitting(true);
    setReviewError(null);
    const result = await reviewDailyReportAction(selected.id, "APPROVED");
    setReviewSubmitting(false);
    if (!result.ok) {
      setReviewError(result.error ?? "No se pudo aprobar el reporte.");
      return;
    }
    closeDetail();
    startTransition(() => router.refresh());
  }

  async function handleConfirmReject() {
    if (!selected) return;
    setReviewSubmitting(true);
    setReviewError(null);
    const result = await reviewDailyReportAction(selected.id, "REJECTED", reviewComment || undefined);
    setReviewSubmitting(false);
    if (!result.ok) {
      setReviewError(result.error ?? "No se pudo rechazar el reporte.");
      return;
    }
    closeDetail();
    startTransition(() => router.refresh());
  }

  const showReviewActions =
    !!selected && canReview && selected.userId !== currentUserId && selected.status === "PENDING";

  return (
    <div>
      {/* Hero — icono grande con degradado + composición asimétrica a la
          izquierda, tarjeta flotante de motivación a la derecha (sección 2
          del pedido de diseño). Este módulo tiene su propio encabezado en
          vez de <PageHeader> genérico, a propósito: es el único que debe
          tener esta presencia "hero". */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-white via-violet-50/50 to-indigo-50/40 p-6 shadow-sm dark:border-violet-900/30 dark:from-[var(--surface-card)] dark:via-violet-950/10 dark:to-indigo-950/10">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-violet-200/50 to-transparent blur-3xl dark:from-violet-800/20" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-gradient-to-tr from-indigo-200/40 to-transparent blur-3xl dark:from-indigo-800/10" />

        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
              <CalendarCheck2 className="h-7 w-7 text-white" />
              <span className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 rounded-full bg-white shadow ring-2 ring-violet-200 dark:ring-violet-800" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Actividades</p>
              <h1 className="mt-0.5 text-2xl font-bold text-[var(--ink-primary)]">Reportes diarios</h1>
              <p className="mt-1.5 max-w-md text-sm text-[var(--ink-secondary)]">
                Registra tus actividades del día. Tu reporte se guardará automáticamente con la fecha y hora,
                y quedará disponible para revisión.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white/80 px-4 py-3 shadow-md shadow-violet-500/5 backdrop-blur-sm dark:border-violet-900/30 dark:bg-white/5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950/50">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <p className="max-w-[13rem] text-xs leading-snug text-[var(--ink-secondary)]">
              Tu esfuerzo de hoy también construye{" "}
              <span className="font-semibold text-violet-600">los resultados de mañana.</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="relative animate-kosmo-fade-in-up overflow-hidden rounded-2xl border-violet-100/80 shadow-md shadow-violet-500/5 dark:border-violet-900/30">
          <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-indigo-400 to-violet-300" />
          <CardContent className="pt-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm shadow-violet-500/30">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--ink-primary)]">Nuevo reporte</h2>
                <p className="text-xs text-[var(--ink-muted)]">Describe tus actividades del día. Sé claro y específico.</p>
              </div>
            </div>

            {formError && (
              <p className="mb-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-[var(--status-critical)]">
                {formError}
              </p>
            )}

            <Textarea
              value={content}
              maxLength={MAX_LEN}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe aquí tu reporte del día..."
              rows={8}
              className="rounded-xl transition-shadow focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)]"
            />
            <div className="mt-1.5 flex items-center justify-between text-xs text-[var(--ink-muted)]">
              <span className="flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                Se guardará automáticamente con la fecha y hora de envío.
              </span>
              <span className={content.length > MAX_LEN * 0.9 ? "font-medium text-[var(--status-warning)]" : undefined}>
                {content.length}/{MAX_LEN}
              </span>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={saving || !content.trim()}
                className="rounded-xl px-5 text-white shadow-lg shadow-violet-500/30 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/40 disabled:hover:translate-y-0"
                style={{ backgroundImage: "linear-gradient(90deg, #7c3aed, #4f46e5)" }}
              >
                <Send className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar reporte"}
              </Button>
              {justSaved && (
                <span className="animate-kosmo-fade-in-scale flex items-center gap-1.5 text-sm font-medium text-[var(--status-good)]">
                  <CheckCircle2 className="h-4 w-4" /> Reporte guardado
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="animate-kosmo-fade-in-up overflow-hidden rounded-2xl border-violet-100/80 bg-gradient-to-b from-violet-50/70 via-[var(--surface-card)] to-[var(--surface-card)] shadow-md shadow-violet-500/5 dark:border-violet-900/30 dark:from-violet-950/20">
          <CardContent className="pt-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950/50">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-base font-semibold text-[var(--ink-primary)]">Importante</h2>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
              Una vez guardado, el reporte no podrá ser editado. Solo será visible para revisión y validación.
            </p>
            <div className="space-y-2">
              {IMPORTANT_ITEMS.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 rounded-xl bg-[var(--surface-card)]/80 p-2.5 shadow-sm ring-1 ring-violet-100/70 dark:ring-violet-900/30"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/50">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--ink-primary)]">{item.title}</p>
                    <p className="text-[11px] text-[var(--ink-muted)]">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-7">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink-primary)]">Historial de reportes</h2>
            <p className="text-xs text-[var(--ink-muted)]">Aquí puedes ver todos tus reportes guardados.</p>
          </div>
          <div className="flex items-center gap-2">
            {preset === "custom" && (
              <>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2 text-xs outline-none focus:border-violet-500"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2 text-xs outline-none focus:border-violet-500"
                />
              </>
            )}
            <RangeFilterPill preset={preset} onChange={setPreset} />
          </div>
        </div>

        <div className={`space-y-2.5 transition-opacity ${isPending ? "opacity-50" : "opacity-100"}`}>
          {filtered.map((r, i) => {
            const { day, monthYear, weekday } = dayBlockParts(r.createdAt);
            const palette = ROW_PALETTE[i % ROW_PALETTE.length];
            return (
              <button
                key={r.id}
                onClick={() => openDetail(r)}
                className="animate-kosmo-fade-in group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] py-4 pl-5 pr-4 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg"
              >
                <span className={cn("absolute inset-y-0 left-0 w-1", palette.accent)} />
                <div className={cn("flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl", palette.block)}>
                  <span className="text-xl font-bold leading-none">{day}</span>
                  <span className="mt-1 text-[9px] font-semibold uppercase leading-none tracking-wide">{monthYear}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--ink-primary)]">
                      Reporte del día · {weekday}
                    </p>
                    {canReview && (
                      <span className="text-xs text-[var(--ink-muted)]">{r.userName}</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">{r.content}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-xs font-medium text-[var(--ink-muted)]">{formatTime(r.createdAt)}</span>
                  <Badge status={statusBadge(r.status)}>{STATUS_LABEL[r.status]}</Badge>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-violet-500" />
              </button>
            );
          })}

          {filtered.length === 0 && reports.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-violet-200 bg-gradient-to-b from-violet-50/50 to-transparent px-6 py-14 text-center dark:border-violet-900/30">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-violet-500 dark:bg-violet-950/40">
                <Inbox className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--ink-primary)]">No hay reportes todavía</p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  Cuando registres tu primera actividad del día, aparecerá aquí.
                </p>
              </div>
            </div>
          )}

          {filtered.length === 0 && reports.length > 0 && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-violet-200 bg-gradient-to-b from-violet-50/50 to-transparent px-6 py-14 text-center dark:border-violet-900/30">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-violet-500 dark:bg-violet-950/40">
                <Inbox className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--ink-primary)]">Sin reportes en este rango</p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  Prueba con otro período. Tus reportes anteriores siguen guardados.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Drawer
        open={!!selected}
        onClose={closeDetail}
        title="Reporte del día"
        subtitle={selected ? dayBlockParts(selected.createdAt).weekday : undefined}
        footer={
          showReviewActions ? (
            rejecting ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setRejecting(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleConfirmReject}
                  disabled={reviewSubmitting}
                >
                  {reviewSubmitting ? "Rechazando..." : "Confirmar rechazo"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="danger" size="sm" onClick={() => setRejecting(true)}>
                  <ThumbsDown className="h-4 w-4" /> Rechazar
                </Button>
                <Button
                  size="sm"
                  style={{ backgroundColor: "#7c3aed" }}
                  onClick={handleApprove}
                  disabled={reviewSubmitting}
                >
                  <ThumbsUp className="h-4 w-4" /> {reviewSubmitting ? "Aprobando..." : "Aprobar"}
                </Button>
              </>
            )
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-950/50">
                {initials(selected.userName)}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--ink-primary)]">{selected.userName}</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  {dayBlockParts(selected.createdAt).day} {dayBlockParts(selected.createdAt).monthYear} ·{" "}
                  {formatTime(selected.createdAt)}
                </p>
              </div>
              <Badge status={statusBadge(selected.status)} className="ml-auto">
                {STATUS_LABEL[selected.status]}
              </Badge>
            </div>

            <div className="border-t border-[var(--border-hairline)]" />

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink-primary)]">
              {selected.content}
            </p>

            {selected.reviewComment && (
              <>
                <div className="border-t border-[var(--border-hairline)]" />
                <div className="rounded-lg bg-[var(--surface-sunken)] p-3">
                  <p className="mb-1 text-xs font-medium text-[var(--ink-secondary)]">
                    Observación de {selected.reviewedByName ?? "el supervisor"}
                  </p>
                  <p className="text-sm text-[var(--ink-primary)]">{selected.reviewComment}</p>
                </div>
              </>
            )}

            {rejecting && (
              <>
                <div className="border-t border-[var(--border-hairline)]" />
                <Textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Motivo del rechazo (opcional, pero ayuda a quien lo escribió)..."
                  rows={3}
                />
              </>
            )}

            {reviewError && (
              <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-[var(--status-critical)]">
                {reviewError}
              </p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function statusBadge(status: DailyReportStatus): "warning" | "good" | "critical" {
  if (status === "APPROVED") return "good";
  if (status === "REJECTED") return "critical";
  return "warning";
}
