import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { ThemeName } from "@prisma/client";
import { prisma } from "./db";

/**
 * Autenticación propia (sin NextAuth/Auth.js) con sesiones en base de datos
 * — a propósito, no JWT stateless: el brief de arquitectura pide poder
 * revocar el acceso de un usuario al instante desde Configuración → Usuarios
 * (clave para un call center con personal rotativo). Borrar la fila de
 * `Session` (o desactivar al usuario) corta el acceso en la siguiente
 * petición, sin esperar a que expire un token firmado.
 */

export const SESSION_COOKIE = "kosmo_session";
const SESSION_TTL_DAYS = 14;
const BCRYPT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Contraseña temporal legible (sin caracteres ambiguos) para cuentas nuevas
 * o restablecidas — el usuario la cambia en su primer login. */
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  roleId: string;
  roleName: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  mustChangePassword: boolean;
  /** "resource:action", ej. "commissions:edit". Rol "Super Admin" tiene acceso total. */
  permissions: Set<string>;
  /** Registro de Agente vinculado a este usuario — todo usuario del sistema
   * es también agente (para poder asignarle leads/comisiones), ver
   * users-actions.ts. Solo es null para cuentas legadas no vinculadas
   * todavía (se resuelve con el backfill del seed). */
  agentId: string | null;
  /** Tema visual elegido (Avatar → Tema del sistema) — ver src/lib/themes.ts. */
  themePreference: ThemeName;
}

/** true si el rol del usuario puede ver todo el negocio, no solo lo propio
 * (permiso "*:view_all" — Super Admin, Admin y Manager en el seed base). */
export function canViewAll(user: SessionUser): boolean {
  return hasPermission(user, "*", "view_all");
}

function permissionKey(resource: string, action: string) {
  return `${resource}:${action}`;
}

export function hasPermission(user: SessionUser, resource: string, action: string): boolean {
  if (user.roleName === "Super Admin") return true;
  return (
    user.permissions.has(permissionKey(resource, action)) ||
    user.permissions.has(permissionKey("*", action)) ||
    user.permissions.has(permissionKey("*", "*"))
  );
}

/** Crea la sesión en base de datos y devuelve el token — quien llame decide
 * cuándo escribir la cookie (solo se puede en un Server Action / Route
 * Handler, nunca durante el render de un Server Component). */
export async function createSession(userId: string, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { id: token, userId, expiresAt, userAgent },
  });
  return token;
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
}

/** Lee la sesión actual (si hay cookie) y devuelve el usuario + permisos, o
 * `null` si no hay sesión, expiró, o el usuario fue desactivado — en ese
 * caso también limpia la fila de Session para no dejar basura. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: token },
    include: {
      user: {
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      },
    },
  });

  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") {
    if (session) await prisma.session.delete({ where: { id: token } }).catch(() => {});
    return null;
  }

  const permissions = new Set(
    session.user.role.permissions.map((rp) => permissionKey(rp.permission.resource, rp.permission.action))
  );

  return {
    id: session.user.id,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    email: session.user.email,
    avatarUrl: session.user.avatarUrl,
    roleId: session.user.roleId,
    roleName: session.user.role.name,
    status: session.user.status,
    mustChangePassword: session.user.mustChangePassword,
    permissions,
    agentId: session.user.agentId,
    themePreference: session.user.themePreference,
  };
}

/** Para usar en layouts/páginas de servidor: redirige a /login si no hay
 * sesión válida, y a /change-password si toca cambiar la contraseña antes de
 * continuar (a menos que ya estemos en esa página). */
export async function requireUser(options?: { allowPasswordChangePending?: boolean }): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !options?.allowPasswordChangePending) {
    redirect("/change-password");
  }
  return user;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
  }
  store.delete(SESSION_COOKIE);
}
