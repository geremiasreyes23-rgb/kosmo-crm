"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { Select } from "@/components/ui/Field";
import { StatCard } from "@/components/ui/StatCard";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { updateCommissionStatusAction } from "./actions";
import type { CommissionVM, CommissionStatus } from "@/types";
import type { CommissionsSummary } from "./data";

const STATUS_OPTIONS: CommissionStatus[] = ["PENDING", "PAID", "CHARGEBACK"];
const STATUS_LABELS: Record<CommissionStatus, string> = {
  PENDING: "Pendiente",
  PAID: "Pagada",
  CHARGEBACK: "Chargeback",
};

export function CommissionsView({
  initialCommissions,
  summary,
}: {
  initialCommissions: CommissionVM[];
  summary: CommissionsSummary;
}) {
  const router = useRouter();

  function handleStatusChange(id: string, status: CommissionStatus) {
    updateCommissionStatusAction(id, status).then((result) => {
      if (!result.ok) {
        window.alert(result.error ?? "No se pudo actualizar la comisión.");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div>
      <PageHeader title="Comisiones" description="Compensación por póliza y estado de pago" />

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Pendientes" value={formatCurrency(summary.pending)} icon={DollarSign} tone="warning" />
        <StatCard label="Pagadas" value={formatCurrency(summary.paid)} icon={TrendingUp} tone="good" />
        <StatCard label="Chargebacks" value={summary.chargebacks} icon={AlertTriangle} tone="critical" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalle por póliza</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Tr>
                <Th>Póliza</Th>
                <Th>Cliente</Th>
                <Th>Línea</Th>
                <Th>Monto vendedor</Th>
                <Th>Monto encargado</Th>
                <Th>Monto AOR</Th>
                <Th>Margen</Th>
                <Th>Estado</Th>
              </Tr>
            </THead>
            <TBody>
              {initialCommissions.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-medium">{c.policyNumber ?? "—"}</Td>
                  <Td>{c.clientName}</Td>
                  <Td>{c.line}</Td>
                  <Td>{c.agentAmount != null ? formatCurrency(c.agentAmount) : "—"}</Td>
                  <Td>{c.managerAmount != null ? formatCurrency(c.managerAmount) : "—"}</Td>
                  <Td>{c.aorAmount != null ? formatCurrency(c.aorAmount) : "—"}</Td>
                  <Td>{c.margin != null ? formatCurrency(c.margin) : "—"}</Td>
                  <Td>
                    <Select
                      className="h-7 w-[140px] rounded-full py-0 text-xs"
                      value={c.status}
                      onChange={(e) => handleStatusChange(c.id, e.target.value as CommissionStatus)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                  </Td>
                </Tr>
              ))}
              {initialCommissions.length === 0 && (
                <Tr>
                  <Td colSpan={8}>
                    <p className="py-6 text-center text-sm text-[var(--ink-muted)]">
                      Sin comisiones todavía. Se generan automáticamente cuando una póliza pasa a estado Activa.
                    </p>
                  </Td>
                </Tr>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
