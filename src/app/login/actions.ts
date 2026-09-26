"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { parseInternalAddress } from "@/lib/mail/config";

export type LoginResult =
  | { ok: false; error: string }
  | { ok: true; firstName: string; lastName: string; redirectTo: string };

/**
 * Acepta como identificador de login TANTO el correo real (User.email, lo de
 * siempre) COMO la dirección de correo interno (usuario@<dominio interno>) —
 * a pedido explícito, para que alguien también pueda entrar con su dirección
 * @alliance.internal. Ninguna cuenta ni contraseña nueva: el InternalMailbox
 * nunca tiene credenciales propias, solo resuelve a QUÉ User pertenece, y de
 * ahí en adelante sigue exactamente el mismo flujo (misma contraseña, mismo
 * chequeo de estado ACTIVE) que si hubiera entrado con su correo real.
 *
 * Se busca primero por dirección interna usando el dominio CON EL QUE se
 * emitió esa fila (InternalMailbox.domainAtCreation), no el dominio "actual"
 * — así sigue funcionando aunque INTERNAL_EMAIL_DOMAIN cambie después (ver
 * src/lib/mail/config.ts). Si no matchea ninguna dirección interna, se cae
 * al lookup de siempre por correo real — un correo real nunca coincide con
 * un domainAtCreation interno, así que no hay ambigüedad entre los dos.
 */
async function resolveLoginUser(identifier: string) {
  const parsed = parseInternalAddress(identifier);
  if (parsed) {
    const mailbox = await prisma.internalMailbox.findUnique({
      where: { localPart_domainAtCreation: { localPart: parsed.localPart, domainAtCreation: parsed.domain } },
      include: { user: true },
    });
    if (mailbox) return mailbox.user;
  }
  return prisma.user.findUnique({ where: { email: identifier } });
}

export async function loginAction(email: string, password: string): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { ok: false, error: "Ingresa tu correo y contraseña." };
  }

  const user = await resolveLoginUser(normalizedEmail);

  // Mensaje genérico a propósito tanto si el correo no existe como si el
  // usuario está desactivado — no revelamos cuál de las dos cosas pasó.
  if (!user || user.status !== "ACTIVE") {
    return { ok: false, error: "Correo o contraseña incorrectos." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "Correo o contraseña incorrectos." };
  }

  const userAgent = (await headers()).get("user-agent") ?? undefined;
  const token = await createSession(user.id, userAgent);
  await setSessionCookie(token);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  // Ya NO redirigimos acá — se lo dejamos al cliente, que primero muestra la
  // animación de bienvenida (esfera al centro + nombre) y navega él mismo
  // cuando termina (ver login/page.tsx). La sesión ya quedó creada arriba,
  // así que la ruta de destino ya la va a ver autenticada cuando llegue.
  return {
    ok: true,
    firstName: user.firstName,
    lastName: user.lastName,
    redirectTo: user.mustChangePassword ? "/change-password" : "/dashboard",
  };
}
