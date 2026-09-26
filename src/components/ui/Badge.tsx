import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type BadgeStatus = "good" | "warning" | "serious" | "critical" | "info" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status?: BadgeStatus;
}

const statusStyles: Record<BadgeStatus, string> = {
  good: "bg-[var(--status-good-bg)] text-[var(--status-good)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  serious: "bg-[var(--status-serious-bg)] text-[var(--status-serious)]",
  critical: "bg-[var(--status-critical-bg)] text-[var(--status-critical)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  neutral: "bg-[var(--surface-sunken)] text-[var(--ink-secondary)]",
};

export function Badge({ status = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status],
        className
      )}
      {...props}
    />
  );
}

/** Traduce estados de póliza / comisión / tarea a la variante visual correcta. */
export function statusToBadgeVariant(status: string): BadgeStatus {
  const map: Record<string, BadgeStatus> = {
    ACTIVE: "good",
    APPROVED: "good",
    PAID: "good",
    COMPLETED: "good",
    CONFIRMED: "good",
    PENDING: "warning",
    QUOTE: "neutral",
    APPLICATION: "info",
    IN_PROGRESS: "info",
    SCHEDULED: "info",
    CANCELLED: "serious",
    REJECTED: "critical",
    CHARGEBACK: "critical",
    NO_SHOW: "critical",
    URGENT: "critical",
    HIGH: "serious",
    MEDIUM: "warning",
    LOW: "neutral",
  };
  return map[status] ?? "neutral";
}
