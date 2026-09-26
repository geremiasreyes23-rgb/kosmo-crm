"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select, Textarea } from "@/components/ui/Field";
import { createDailyReportAction, reviewDailyReportAction } from "./reports-actions";
import { useNotifyToast } from "@/components/notifications/ToastNotificationProvider";
import { formatTime, initials } from "@/lib/utils";
import type { DailyReportVM, DailyReportStatus } from "@/types";
import {
  Send,
  Lock,
  Clock3,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Inbox,
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
      <PageHeader
        title="Reportes diarios"
        description="Cada reporte se guarda automáticamente con tu fecha y hora exactas."
      />

      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-violet-200/70 bg-gradient-to-r from-violet-50 via-violet-50/60 to-transparent px-4 py-3 dark:border-violet-900/40 dark:from-violet-950/30 dark:via-violet-950/10">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600/10 text-violet-600">
          <Sparkles className="h-4.5 w-4.5" />
        </div>
        <p className="text-sm text-[var(--ink-secondary)]">
          Tu esfuerzo de hoy también construye los resultados de mañana.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="animate-kosmo-fade-in-up overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-indigo-400 to-violet-300" />
          <CardContent className="pt-4">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-violet-600" />
              <h2 className="text-sm font-semibold text-[var(--ink-primary)]">Nuevo reporte</h2>
            </div>
            <p className="mb-3 text-xs text-[var(--ink-muted)]">
              Cuéntanos qué hiciste hoy: gestiones, llamadas, resultados y pendientes.
            </p>

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
              rows={6}
              className="transition-shadow focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)]"
            />
            <div className="mt-1.5 flex items-center justify-between text-xs text-[var(--ink-muted)]">
              <span className="flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                Se guardará con la fecha y hora de este momento.
              </span>
              <span className={content.length > MAX_LEN * 0.9 ? "font-medium text-[var(--status-warning)]" : undefined}>
                {content.length}/{MAX_LEN}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={saving || !content.trim()}
                style={{ backgroundColor: "#7c3aed" }}
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

        <Card className="animate-kosmo-fade-in-up border-violet-200/70 bg-gradient-to-b from-violet-50/60 to-transparent dark:border-violet-900/40 dark:from-violet-950/20">
          <CardContent className="pt-4">
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-violet-600" />
              <h2 className="text-sm font-semibold text-[var(--ink-primary)]">Importante</h2>
            </div>
            <p className="mb-3 text-xs text-[var(--ink-secondary)]">
              Una vez guardado, tu reporte queda registrado de forma permanente y no podrá editarse.
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 rounded-lg bg-[var(--surface-card)]/70 px-2.5 py-1.5 text-xs text-[var(--ink-secondary)]">
                <Lock className="h-3.5 w-3.5 text-violet-600" /> Seguro
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-[var(--surface-card)]/70 px-2.5 py-1.5 text-xs text-[var(--ink-secondary)]">
                <Clock3 className="h-3.5 w-3.5 text-violet-600" /> Automático
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-[var(--surface-card)]/70 px-2.5 py-1.5 text-xs text-[var(--ink-secondary)]">
                <CheckCircle2 className="h-3.5 w-3.5 text-violet-600" /> Sin ediciones
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--ink-primary)]">Historial de reportes</h2>
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
            <Select
              value={preset}
              onChange={(e) => setPreset(e.target.value as RangePreset)}
              className="w-auto"
            >
              {(Object.keys(RANGE_LABELS) as RangePreset[]).map((key) => (
                <option key={key} value={key}>
                  {RANGE_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className={`space-y-2 transition-opacity ${isPending ? "opacity-50" : "opacity-100"}`}>
          {filtered.map((r) => {
            const { day, monthYear, weekday } = dayBlockParts(r.createdAt);
            return (
              <button
                key={r.id}
                onClick={() => openDetail(r)}
                className="animate-kosmo-fade-in group flex w-full items-center gap-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
              >
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/40">
                  <span className="text-lg font-bold leading-none">{day}</span>
                  <span className="mt-0.5 text-[10px] uppercase leading-none">{monthYear}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[var(--ink-primary)]">
                      Reporte del día · {weekday}
                    </p>
                    <Badge status={statusBadge(r.status)}>{STATUS_LABEL[r.status]}</Badge>
                    {canReview && (
                      <span className="text-xs text-[var(--ink-muted)]">{r.userName}</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">{r.content}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-[var(--ink-muted)]">
                  <span>{formatTime(r.createdAt)}</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <Inbox className="h-8 w-8 text-[var(--ink-muted)]" />
                <p className="text-sm text-[var(--ink-muted)]">
                  No hay reportes en este rango de fechas.
                </p>
              </CardContent>
            </Card>
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
