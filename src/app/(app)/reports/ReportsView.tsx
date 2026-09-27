"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FileDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { exportReportAction, type ReportKey } from "./actions";

interface ReportDef {
  key: ReportKey;
  label: string;
}

const reportGroups: { title: string; reports: ReportDef[] }[] = [
  {
    title: "Ventas",
    reports: [
      { key: "ventas_mensuales", label: "Ventas mensuales" },
      { key: "ventas_por_vendedor", label: "Ventas por vendedor" },
      { key: "ventas_por_linea", label: "Ventas por línea" },
      { key: "ventas_por_carrier", label: "Ventas por carrier" },
    ],
  },
  {
    title: "Clientes y leads",
    reports: [
      { key: "clientes_nuevos", label: "Clientes nuevos" },
      { key: "leads_generados", label: "Leads generados" },
      { key: "conversion_leads", label: "Conversión de leads" },
      { key: "clientes_antiguedad", label: "Clientes por antigüedad" },
      { key: "turning_65", label: "Turning 65" },
    ],
  },
  {
    title: "Pólizas y comisiones",
    reports: [
      { key: "polizas_activas", label: "Pólizas activas" },
      { key: "polizas_canceladas", label: "Pólizas canceladas" },
      { key: "comisiones", label: "Comisiones" },
      { key: "chargebacks", label: "Chargebacks" },
      { key: "margen", label: "Margen" },
    ],
  },
  {
    title: "Operación",
    reports: [
      { key: "actividades", label: "Actividades" },
      { key: "productividad_vendedores", label: "Productividad de vendedores" },
    ],
  },
];

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ReportsView() {
  const [loadingKey, setLoadingKey] = useState<ReportKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(key: ReportKey) {
    setLoadingKey(key);
    setError(null);
    const result = await exportReportAction(key);
    setLoadingKey(null);
    if (!result.ok || !result.csv || !result.filename) {
      setError(result.error ?? "No se pudo generar el reporte.");
      return;
    }
    downloadCsv(result.filename, result.csv);
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-[var(--status-critical-bg)] px-3 py-2 text-xs text-[var(--status-critical)]">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {reportGroups.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.reports.map((r) => (
                <div
                  key={r.key}
                  className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] px-3 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[var(--ink-muted)]" /> {r.label}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Exportar CSV"
                      disabled={loadingKey === r.key}
                      onClick={() => handleExport(r.key)}
                    >
                      {loadingKey === r.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Exportar para Excel"
                      title="Genera un .csv que se abre directamente en Excel"
                      disabled={loadingKey === r.key}
                      onClick={() => handleExport(r.key)}
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
