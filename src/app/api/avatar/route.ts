import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Foto de perfil de un usuario como imagen real, para mostrarla en listas,
 * selectores y tablas sin incrustar el data URL completo de cada persona en
 * la página (User.avatarUrl puede pesar cientos de KB).
 *
 *   /api/avatar?user=<User.id>    → foto del usuario
 *   /api/avatar?agent=<Agent.id>  → foto del usuario vinculado a ese agente
 *
 * Responde 404 si no hay foto (el componente PersonAvatar muestra entonces
 * las iniciales). El navegador la guarda 5 minutos y luego revalida con
 * ETag basado en User.updatedAt, así que la foto en sí solo se vuelve a leer
 * de la base de datos cuando el usuario cambió.
 */
export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) return new Response("No autorizado", { status: 401 });

  const url = new URL(request.url);
  const userId = url.searchParams.get("user");
  const agentId = url.searchParams.get("agent");
  if (!userId && !agentId) return new Response("Falta user o agent", { status: 400 });

  const where = userId ? { id: userId } : { agentId: agentId! };
  const meta = await prisma.user.findFirst({ where, select: { id: true, updatedAt: true } });
  if (!meta) return notFound();

  const etag = `"${meta.id}-${meta.updatedAt.getTime()}"`;
  const cacheHeaders = { "Cache-Control": "private, max-age=300", ETag: etag };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: cacheHeaders });
  }

  const row = await prisma.user.findUnique({ where: { id: meta.id }, select: { avatarUrl: true } });
  const avatar = row?.avatarUrl?.trim();
  if (!avatar) return notFound();

  if (/^https?:\/\//i.test(avatar)) {
    return new Response(null, { status: 302, headers: { ...cacheHeaders, Location: avatar } });
  }
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(avatar);
  if (!match || !match[1].startsWith("image/")) return notFound();
  const bytes = match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]));

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { ...cacheHeaders, "Content-Type": match[1], "Content-Length": String(bytes.length) },
  });
}

function notFound() {
  return new Response("Sin foto", { status: 404, headers: { "Cache-Control": "private, max-age=300" } });
}
