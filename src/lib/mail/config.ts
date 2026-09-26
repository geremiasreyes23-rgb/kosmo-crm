import "server-only";

/**
 * Configuración del dominio de Correo interno — TODO lo que decide si una
 * dirección es "de la casa" vive acá, en un solo lugar, para que activar
 * correo externo en el futuro (sección 9 del brief: "preparado para
 * evolucionar hacia correo corporativo externo sin reconstruir la
 * arquitectura") sea agregar una función nueva (sendExternalMail) sin tocar
 * esta ni la lógica de validación de destinatarios.
 *
 * INTERNAL_EMAIL_DOMAIN se define en .env.local — nunca hardcodeado. Un
 * dominio real (ej. "allianceinsurance.com") funciona igual que uno
 * inventado: la única regla dura es que NUNCA se usa este dominio para
 * enviar correo saliente a internet — ver isInternalRecipient() más abajo,
 * que es la función que hace estructuralmente imposible salir del sistema.
 */

const DEFAULT_DOMAIN = "alliance.internal";

/** Dominios que Node/algunos sistemas operativos resuelven de forma especial
 * (mDNS, loopback) — el brief pide explícitamente evitarlos para que el
 * dominio interno nunca choque con resolución de red real. */
const DISCOURAGED_SUFFIXES = [".local", ".localhost", ".test", ".invalid", ".example"];

let warnedOnce = false;

export function getInternalMailDomain(): string {
  const raw = (process.env.INTERNAL_EMAIL_DOMAIN || DEFAULT_DOMAIN).trim().toLowerCase();
  const domain = raw || DEFAULT_DOMAIN;

  if (!warnedOnce && DISCOURAGED_SUFFIXES.some((suffix) => domain.endsWith(suffix))) {
    warnedOnce = true;
    // No se lanza error — el módulo debe poder arrancar igual — pero queda
    // registrado en los logs del servidor para que un admin lo corrija.
    console.warn(
      `[mail] INTERNAL_EMAIL_DOMAIN="${domain}" usa un sufijo reservado (${DISCOURAGED_SUFFIXES.join(", ")}) ` +
        "que puede chocar con resolución de red real. Se recomienda algo como \"empresa.internal\"."
    );
  }

  return domain;
}

/** true si el módulo de Correo interno está prendido — leído desde
 * MailSettings (fila "singleton"), NO desde una variable de entorno, para
 * que un Admin pueda apagarlo en caliente desde Configuración sin redeploy.
 * Vive acá, no en mailbox.ts, para que toda decisión de "¿está prendido el
 * correo?" pase por un solo punto. */
export async function isInternalMailEnabled(): Promise<boolean> {
  const { prisma } = await import("@/lib/db");
  const settings = await prisma.mailSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return settings.isEnabled;
}

export function buildInternalAddress(localPart: string, domain: string): string {
  return `${localPart}@${domain}`;
}

/**
 * La función que hace cumplir "los mensajes externos no están habilitados":
 * un destinatario solo es válido si es exactamente `localPart@domain` de un
 * InternalMailbox que YA EXISTE en la base de datos — nunca se acepta una
 * dirección con el dominio correcto pero sin fila real (evita enumeración /
 * suplantación), y CUALQUIER otro dominio se rechaza sin excepción.
 */
export function parseInternalAddress(address: string): { localPart: string; domain: string } | null {
  const trimmed = address.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  return { localPart: trimmed.slice(0, at), domain: trimmed.slice(at + 1) };
}
