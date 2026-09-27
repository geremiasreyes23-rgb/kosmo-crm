"use client";

import { useState } from "react";
import { Mail, ShieldAlert, Users, Send, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/Field";
import {
  updateMailSettingsAction,
  getMailAuditTrail,
  type MailAdminOverview,
  type MailAuditRowVM,
} from "@/app/(app)/settings/mail-settings-actions";
import { adminInspectMailboxAction } from "@/app/(app)/mail/actions";
import type { MailRetentionPolicy } from "@prisma/client";

const RETENTION_LABEL: Record<MailRetentionPolicy, string> = {
  DAYS_30: "30 días",
  DAYS_90: "90 días",
  YEAR_1: "1 año",
  INDEFINITE: "Indefinido",
};

const ACTION_LABEL: Record<string, string> = {
  MESSAGE_CREATED: "Mensaje creado",
  MESSAGE_SENT: "Mensaje enviado",
  MESSAGE_READ: "Mensaje leído",
  MESSAGE_DELETED: "Mensaje eliminado",
  MESSAGE_ARCHIVED: "Mensaje archivado",
  ATTACHMENT_UPLOADED: "Adjunto subido",
  ATTACHMENT_DOWNLOADED: "Adjunto descargado",
  ATTACHMENT_DELETED: "Adjunto eliminado",
  MAILBOX_ACCESSED: "Buzón accedido",
  EXTERNAL_RECIPIENT_BLOCKED: "Destinatario externo bloqueado",
  ADMIN_ACCESS_GRANTED: "Acceso administrativo excepcional",
};

export function MailSettingsPanel({
  overview,
  userOptions,
}: {
  overview: MailAdminOverview;
  userOptions: { id: string; name: string }[];
}) {
  const [isEnabled, setIsEnabled] = useState(overview.isEnabled);
  const [maxMb, setMaxMb] = useState(overview.maxAttachmentSizeMb);
  const [extensionsText, setExtensionsText] = useState(overview.allowedExtensions.join(", "));
  const [retention, setRetention] = useState<MailRetentionPolicy>(overview.retentionPolicy);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRows, setAuditRows] = useState<MailAuditRowVM[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [inspectUserId, setInspectUserId] = useState("");
  const [inspectReason, setInspectReason] = useState("");
  const [inspectBusy, setInspectBusy] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspectResult, setInspectResult] = useState<{ address: string; messages: { subject: string; from: string; to: string; sentAt: string | null }[] } | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    const result = await updateMailSettingsAction({
      isEnabled,
      maxAttachmentSizeMb: maxMb,
      allowedExtensions: extensionsText.split(",").map((e) => e.trim()).filter(Boolean),
      retentionPolicy: retention,
    });
    setSaving(false);
    setSaveMsg(result.ok ? "Guardado." : result.error ?? "No se pudo guardar.");
  }

  async function handleOpenAudit() {
    setAuditOpen(true);
    setAuditLoading(true);
    const rows = await getMailAuditTrail();
    setAuditRows(rows);
    setAuditLoading(false);
  }

  async function handleInspect() {
    if (!inspectUserId) {
      setInspectError("Selecciona un usuario.");
      return;
    }
    setInspectBusy(true);
    setInspectError(null);
    setInspectResult(null);
    const result = await adminInspectMailboxAction(inspectUserId, inspectReason);
    setInspectBusy(false);
    if (!result.ok) {
      setInspectError(result.error);
      return;
    }
    setInspectResult(result);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Buzones" value={String(overview.mailboxCount)} icon={Mail} />
        <StatCard label="Buzones activos" value={String(overview.activeMailboxCount)} icon={Users} tone="good" />
        <StatCard label="Correos enviados" value={String(overview.sentCount)} icon={Send} />
        <StatCard label="Almacenamiento (adjuntos)" value={`${overview.storageUsedMb} MB`} icon={HardDrive} />
      </div>

      <div className="rounded-xl border border-[var(--border-hairline)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4 text-[var(--brand-500)]" />
          <h3 className="text-sm font-semibold">Configuración del módulo</h3>
        </div>
        <p className="mb-4 text-xs text-[var(--ink-muted)]">
          Dominio interno vigente: <span className="font-mono font-medium text-[var(--ink-primary)]">@{overview.domain}</span>, se
          cambia con la variable de entorno <span className="font-mono">INTERNAL_EMAIL_DOMAIN</span>, no desde aquí (las direcciones
          ya emitidas se conservan tal cual se crearon aunque el dominio cambie).
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} className="h-4 w-4" />
            Correo interno habilitado
          </label>

          <FieldWrapper label="Límite de adjunto (MB)">
            <Input type="number" min={1} max={100} value={maxMb} onChange={(e) => setMaxMb(Number(e.target.value))} />
          </FieldWrapper>

          <FieldWrapper label="Extensiones permitidas (separadas por coma)">
            <Input value={extensionsText} onChange={(e) => setExtensionsText(e.target.value)} />
          </FieldWrapper>

          <FieldWrapper label="Política de retención">
            <Select value={retention} onChange={(e) => setRetention(e.target.value as MailRetentionPolicy)}>
              {Object.entries(RETENTION_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FieldWrapper>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
          {saveMsg && <span className="text-xs text-[var(--ink-muted)]">{saveMsg}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-hairline)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[var(--status-warning)]" />
          <h3 className="text-sm font-semibold">Acceso excepcional a un buzón</h3>
        </div>
        <p className="mb-3 text-xs text-[var(--ink-muted)]">
          Nadie (ni un Admin) ve el correo de otro usuario por defecto. Esto solo funciona con un motivo explícito, y queda
          registrado en la auditoría como acceso administrativo excepcional.
        </p>
        <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
          <Select value={inspectUserId} onChange={(e) => setInspectUserId(e.target.value)}>
            <option value="">Selecciona un usuario...</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Textarea
            value={inspectReason}
            onChange={(e) => setInspectReason(e.target.value)}
            placeholder="Motivo del acceso (obligatorio, mínimo 10 caracteres)…"
            rows={1}
          />
          <Button size="sm" variant="secondary" onClick={handleInspect} disabled={inspectBusy}>
            {inspectBusy ? "Consultando..." : "Inspeccionar"}
          </Button>
        </div>
        {inspectError && <p className="mt-2 text-xs text-[var(--status-critical)]">{inspectError}</p>}
        {inspectResult && (
          <div className="mt-3 rounded-lg border border-[var(--border-hairline)] p-3">
            <p className="mb-2 text-xs font-medium">{inspectResult.address}</p>
            {inspectResult.messages.length === 0 ? (
              <p className="text-xs text-[var(--ink-muted)]">Sin correos.</p>
            ) : (
              <ul className="space-y-1">
                {inspectResult.messages.map((m, i) => (
                  <li key={i} className="text-xs text-[var(--ink-secondary)]">
                    <span className="font-medium">{m.subject}</span>: de {m.from} ({m.to})
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border-hairline)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Auditoría</h3>
          {!auditOpen && (
            <Button size="sm" variant="secondary" onClick={handleOpenAudit}>
              Ver registro
            </Button>
          )}
        </div>
        {auditOpen && (
          <div className="max-h-72 overflow-y-auto">
            {auditLoading ? (
              <p className="text-xs text-[var(--ink-muted)]">Cargando...</p>
            ) : auditRows.length === 0 ? (
              <p className="text-xs text-[var(--ink-muted)]">Sin actividad todavía.</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {auditRows.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--border-hairline)] last:border-0">
                      <td className="py-1.5 pr-2 text-[var(--ink-muted)]">{new Date(r.createdAt).toLocaleString("es-DO")}</td>
                      <td className="py-1.5 pr-2 font-medium">{r.actorName}</td>
                      <td className="py-1.5 pr-2">
                        <Badge status="info">{ACTION_LABEL[r.action] ?? r.action}</Badge>
                      </td>
                      <td className="py-1.5 pr-2 text-[var(--ink-muted)]">{r.mailboxAddress ?? "—"}</td>
                      <td className="py-1.5 text-[var(--ink-muted)]">{r.ipAddress ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
