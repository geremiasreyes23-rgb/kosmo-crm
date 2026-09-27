"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { Badge, type BadgeStatus } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, FieldWrapper } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Drawer";
import { uploadDocumentAction } from "@/lib/documents/actions";
import type { RelatedEntityOptions } from "@/lib/relatedRecords";
import type { DocumentVM } from "@/types";
import { formatDate, formatBytes } from "@/lib/utils";
import { Search, Paperclip, FileText, FolderOpen } from "lucide-react";

type RelatedTypeFilter = "" | "Lead" | "Client" | "Sale" | "Policy";

const RELATED_TYPE_LABELS: Record<"Lead" | "Client" | "Sale" | "Policy", string> = {
  Lead: "Lead",
  Client: "Cliente",
  Sale: "Venta",
  Policy: "Póliza",
};

const RELATED_TYPE_BADGE: Record<"Lead" | "Client" | "Sale" | "Policy", BadgeStatus> = {
  Lead: "info",
  Client: "good",
  Sale: "warning",
  Policy: "neutral",
};

const MAX_DOCUMENT_SIZE_MB = 8;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function DocumentsView({
  initialDocuments,
  relatedOptions,
  canUpload,
}: {
  initialDocuments: DocumentVM[];
  relatedOptions: RelatedEntityOptions;
  canUpload: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentVM[]>(initialDocuments);
  useEffect(() => setDocuments(initialDocuments), [initialDocuments]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<RelatedTypeFilter>("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [targetType, setTargetType] = useState<"lead" | "client">("client");
  const [targetId, setTargetId] = useState("");
  const [category, setCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const d of documents) if (d.category) set.add(d.category);
    return Array.from(set).sort();
  }, [documents]);

  const visibleDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (categoryFilter && d.category !== categoryFilter) return false;
      if (typeFilter && d.relatedType !== typeFilter) return false;
      if (!q) return true;
      return (
        d.fileName.toLowerCase().includes(q) ||
        (d.relatedLabel ?? "").toLowerCase().includes(q) ||
        (d.category ?? "").toLowerCase().includes(q) ||
        d.uploadedByName.toLowerCase().includes(q)
      );
    });
  }, [documents, search, categoryFilter, typeFilter]);

  const targetOptions = targetType === "lead" ? relatedOptions.leads : relatedOptions.clients;

  function openDrawer() {
    setTargetType("client");
    setTargetId("");
    setCategory("");
    setUploadError(null);
    setDrawerOpen(true);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!targetId) {
      setUploadError("Elige a qué lead o cliente pertenece el documento antes de adjuntarlo.");
      return;
    }
    setUploadError(null);
    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > MAX_DOCUMENT_SIZE_MB * 1024 * 1024) {
        setUploadError(`"${file.name}" supera el límite de ${MAX_DOCUMENT_SIZE_MB}MB.`);
        continue;
      }
      const dataUrl = await readFileAsDataUrl(file);
      const result = await uploadDocumentAction({
        fileName: file.name,
        dataUrl,
        sizeBytes: file.size,
        category: category.trim() || undefined,
        relatedLeadId: targetType === "lead" ? targetId : undefined,
        relatedClientId: targetType === "client" ? targetId : undefined,
      });
      if (!result.ok) {
        setUploadError(result.error ?? `No se pudo subir "${file.name}".`);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Documentos"
        description="Todos los documentos del CRM en un solo lugar: leads, clientes, ventas y pólizas"
        actions={
          canUpload ? (
            <Button size="sm" onClick={openDrawer}>
              <Paperclip className="h-4 w-4" /> Subir documento
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, categoría o registro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select className="w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as RelatedTypeFilter)}>
          <option value="">Todos los registros</option>
          <option value="Lead">Leads</option>
          <option value="Client">Clientes</option>
          <option value="Sale">Ventas</option>
          <option value="Policy">Pólizas</option>
        </Select>
        {allCategories.length > 0 && (
          <Select className="w-auto" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Todas las categorías</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        )}
      </div>

      <Card>
        {visibleDocuments.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-sunken)]">
              <FolderOpen className="h-6 w-6 text-[var(--ink-muted)]" />
            </div>
            {documents.length === 0 ? (
              <div>
                <p className="text-sm font-medium">Todavía no hay documentos</p>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                  Los documentos que subas aquí o desde el detalle de un lead o cliente aparecerán en este listado.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium">Sin resultados</p>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">Prueba con otra búsqueda o quita algún filtro.</p>
              </div>
            )}
          </div>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Documento</Th>
                <Th>Relacionado</Th>
                <Th>Categoría</Th>
                <Th>Subido por</Th>
                <Th>Fecha</Th>
              </Tr>
            </THead>
            <TBody>
              {visibleDocuments.map((d) => (
                <Tr key={d.id}>
                  <Td>
                    <a
                      href={d.fileUrl}
                      download={d.fileName}
                      className="flex min-w-0 items-center gap-2.5 hover:underline"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.fileName}</p>
                        <p className="text-xs text-[var(--ink-muted)]">
                          {formatBytes(Math.round((d.fileUrl.length * 3) / 4))}
                        </p>
                      </div>
                    </a>
                  </Td>
                  <Td>
                    {d.relatedType && d.relatedLabel ? (
                      <Link href={d.relatedHref ?? "#"} className="inline-flex items-center gap-1.5 hover:underline">
                        <Badge status={RELATED_TYPE_BADGE[d.relatedType]}>{RELATED_TYPE_LABELS[d.relatedType]}</Badge>
                        <span className="text-sm">{d.relatedLabel}</span>
                      </Link>
                    ) : (
                      <span className="text-sm text-[var(--ink-muted)]">—</span>
                    )}
                  </Td>
                  <Td>{d.category ?? <span className="text-[var(--ink-muted)]">—</span>}</Td>
                  <Td>{d.uploadedByName}</Td>
                  <Td>{formatDate(d.uploadedAt)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Subir documento" subtitle="Se guarda ligado a un lead o cliente específico">
        <div className="space-y-4">
          {uploadError && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-[var(--status-critical)]">
              {uploadError}
            </p>
          )}

          <FieldWrapper label="Pertenece a">
            <Select
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value as "lead" | "client");
                setTargetId("");
              }}
            >
              <option value="client">Cliente</option>
              <option value="lead">Lead</option>
            </Select>
          </FieldWrapper>

          <FieldWrapper label={targetType === "lead" ? "Lead" : "Cliente"}>
            <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Selecciona...</option>
              {targetOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FieldWrapper>

          <FieldWrapper label="Categoría (opcional)">
            <Input
              placeholder="Ej. Identificación, Aplicación, Comprobante..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </FieldWrapper>

          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || !targetId}
          >
            <Paperclip className="h-4 w-4" /> {uploading ? "Subiendo..." : "Elegir archivo(s)"}
          </Button>
          {!targetId && (
            <p className="text-xs text-[var(--ink-muted)]">Elige primero a quién pertenece el documento.</p>
          )}
        </div>
      </Drawer>
    </div>
  );
}
