"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, KeyRound, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input, Select } from "@/components/ui/Field";
import { formatDate } from "@/lib/utils";
import {
  createUserAction,
  updateUserAction,
  setUserStatusAction,
  resetPasswordAction,
  deleteUserAction,
} from "@/app/(app)/settings/users-actions";

export interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  roleId: string;
  roleName: string;
  lastLoginAt: string | null;
}

export interface RoleOption {
  id: string;
  name: string;
}

const emptyForm = { firstName: "", lastName: "", email: "", roleId: "" };

export function UsersPanel({
  initialUsers,
  roles,
  currentUserId,
}: {
  initialUsers: UserRow[];
  roles: RoleOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirming, setConfirming] = useState<
    { type: "deactivate" | "delete"; user: UserRow } | null
  >(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [credentials, setCredentials] = useState<{ name: string; email: string; password: string } | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  function openCreate() {
    setEditingUser(null);
    setForm({ ...emptyForm, roleId: roles[0]?.id ?? "" });
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(user: UserRow) {
    setEditingUser(user);
    setForm({ firstName: user.firstName, lastName: user.lastName, email: user.email, roleId: user.roleId });
    setFormError(null);
    setDrawerOpen(true);
  }

  async function handleSubmit() {
    setSaving(true);
    setFormError(null);
    const result = editingUser
      ? await updateUserAction(editingUser.id, form)
      : await createUserAction(form);
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error ?? "No se pudo guardar.");
      return;
    }

    setDrawerOpen(false);
    if (result.tempPassword) {
      setCredentials({
        name: `${form.firstName} ${form.lastName}`,
        email: form.email.trim().toLowerCase(),
        password: result.tempPassword,
      });
    }
    router.refresh();
  }

  async function handleResetPassword(user: UserRow) {
    setBusyUserId(user.id);
    const result = await resetPasswordAction(user.id);
    setBusyUserId(null);
    if (result.ok && result.tempPassword) {
      setCredentials({ name: `${user.firstName} ${user.lastName}`, email: user.email, password: result.tempPassword });
      router.refresh();
    }
  }

  async function handleActivate(user: UserRow) {
    setBusyUserId(user.id);
    await setUserStatusAction(user.id, "ACTIVE");
    setBusyUserId(null);
    router.refresh();
  }

  async function handleConfirm() {
    if (!confirming) return;
    setConfirmBusy(true);
    setConfirmError(null);
    const result =
      confirming.type === "deactivate"
        ? await setUserStatusAction(confirming.user.id, "INACTIVE")
        : await deleteUserAction(confirming.user.id);
    setConfirmBusy(false);

    if (!result.ok) {
      setConfirmError(result.error ?? "No se pudo completar la acción.");
      return;
    }
    setConfirming(null);
    router.refresh();
  }

  function copyPassword() {
    if (!credentials) return;
    navigator.clipboard?.writeText(credentials.password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-[var(--ink-muted)]">
          {initialUsers.length} usuario{initialUsers.length === 1 ? "" : "s"}. Crea, edita o desactiva accesos
          según entre y salga personal del call center.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nuevo usuario
        </Button>
      </div>

      <Table>
        <THead>
          <Tr>
            <Th>Nombre</Th>
            <Th>Correo</Th>
            <Th>Rol</Th>
            <Th>Estado</Th>
            <Th>Último acceso</Th>
            <Th></Th>
          </Tr>
        </THead>
        <TBody>
          {initialUsers.map((user) => {
            const isSelf = user.id === currentUserId;
            const busy = busyUserId === user.id;
            return (
              <Tr key={user.id}>
                <Td className="font-medium">
                  {user.firstName} {user.lastName}
                  {isSelf && <span className="ml-1.5 text-xs text-[var(--ink-muted)]">(tú)</span>}
                </Td>
                <Td>{user.email}</Td>
                <Td>{user.roleName}</Td>
                <Td>
                  <Badge status={user.status === "ACTIVE" ? "good" : "critical"}>
                    {user.status === "ACTIVE" ? "Activo" : "Desactivado"}
                  </Badge>
                </Td>
                <Td>{user.lastLoginAt ? formatDate(user.lastLoginAt) : "Nunca"}</Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      title="Editar"
                      onClick={() => openEdit(user)}
                      className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Restablecer contraseña"
                      disabled={busy}
                      onClick={() => handleResetPassword(user)}
                      className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    {user.status === "ACTIVE" ? (
                      <button
                        type="button"
                        title="Desactivar"
                        disabled={isSelf}
                        onClick={() => setConfirming({ type: "deactivate", user })}
                        className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--status-warning-bg)] hover:text-[var(--status-warning)] disabled:opacity-40"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Activar"
                        disabled={busy}
                        onClick={() => handleActivate(user)}
                        className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--status-good-bg)] hover:text-[var(--status-good)] disabled:opacity-50"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Eliminar"
                      disabled={isSelf}
                      onClick={() => setConfirming({ type: "delete", user })}
                      className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--status-critical-bg)] hover:text-[var(--status-critical)] disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>

      <Modal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingUser ? "Editar usuario" : "Nuevo usuario"}
        description={editingUser ? undefined : "Se genera una contraseña temporal. El usuario la cambia en su primer ingreso."}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Nombre">
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </FieldWrapper>
            <FieldWrapper label="Apellido">
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </FieldWrapper>
          </div>
          <FieldWrapper label="Correo electrónico">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="nombre@kosmocrm.com"
            />
          </FieldWrapper>
          <FieldWrapper label="Rol">
            <Select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </FieldWrapper>
          {formError && (
            <p className="rounded-lg border border-red-200 bg-[var(--status-critical-bg)] px-3 py-2 text-xs text-[var(--status-critical)]">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando..." : editingUser ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Credenciales generadas — solo se muestran una vez */}
      <Modal open={!!credentials} onClose={() => setCredentials(null)} title="Contraseña temporal generada">
        {credentials && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--ink-secondary)]">
              Comparte estos datos con <span className="font-medium">{credentials.name}</span>. La contraseña
              no se volverá a mostrar. Se le pedirá cambiarla en su primer ingreso.
            </p>
            <div className="space-y-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-sunken)] p-3 text-sm">
              <p>
                <span className="text-[var(--ink-muted)]">Correo: </span>
                {credentials.email}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-base font-semibold tracking-wide">{credentials.password}</span>
                <Button size="sm" variant="secondary" onClick={copyPassword}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setCredentials(null)}>
                Listo
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmación de desactivar / eliminar */}
      <Modal
        open={!!confirming}
        onClose={() => {
          setConfirming(null);
          setConfirmError(null);
        }}
        title={confirming?.type === "delete" ? "Eliminar usuario" : "Desactivar usuario"}
      >
        {confirming && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--ink-secondary)]">
              {confirming.type === "delete" ? (
                <>
                  ¿Eliminar a <span className="font-medium">{confirming.user.firstName} {confirming.user.lastName}</span> permanentemente?
                  Si tiene historial en el sistema (leads, ventas, auditoría), no se podrá eliminar. Desactívalo en su lugar.
                </>
              ) : (
                <>
                  ¿Desactivar a <span className="font-medium">{confirming.user.firstName} {confirming.user.lastName}</span>?
                  Perderá acceso de inmediato. Su sesión activa se cierra y no podrá volver a ingresar hasta que lo actives de nuevo.
                </>
              )}
            </p>
            {confirmError && (
              <p className="rounded-lg border border-red-200 bg-[var(--status-critical-bg)] px-3 py-2 text-xs text-[var(--status-critical)]">
                {confirmError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirming(null)}>
                Cancelar
              </Button>
              <Button variant="danger" size="sm" onClick={handleConfirm} disabled={confirmBusy}>
                {confirmBusy ? "Procesando..." : confirming.type === "delete" ? "Eliminar" : "Desactivar"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
