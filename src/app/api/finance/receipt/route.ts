import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canViewFinance } from "@/lib/finance/access";

export const dynamic = "force-dynamic";

/** Comprobante de un movimiento del Control Financiero (/api/finance/receipt?id=…).
 * Solo para quien puede ver las finanzas. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (!(await canViewFinance(user))) return new Response("Sin acceso", { status: 403 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return new Response("Falta id", { status: 400 });
  const row = await prisma.financeTransaction.findUnique({
    where: { id },
    select: { receiptFileName: true, receiptDataUrl: true },
  });
  const match = row?.receiptDataUrl ? /^data:([^;,]+);base64,([\s\S]*)$/.exec(row.receiptDataUrl) : null;
  if (!row || !match) return new Response("Sin comprobante", { status: 404 });

  const bytes = Buffer.from(match[2], "base64");
  const name = (row.receiptFileName ?? "comprobante").replace(/["\r\n]/g, "");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": match[1],
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
