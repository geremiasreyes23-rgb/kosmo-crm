import {
  LINE_DEFS,
  ageFromDob,
  displayValue,
  isFieldVisible,
  noneKey,
  sensitiveKeyFor,
  type LineCode,
  type LineValues,
  type ListItem,
} from "@/lib/leads/lineSchema";
import { Turning65Alert } from "@/components/leads/form/LineFields";
import { LeadRestrictedPanel, type RestrictedItem } from "@/components/leads/LeadRestrictedPanel";
import { LeadRestrictedValue } from "@/components/leads/LeadRestrictedValue";
import { HScroll } from "@/components/ui/HScroll";

/** Vista de solo lectura de "Información de [línea]" en el detalle del lead.
 * Muestra exclusivamente los campos de la línea del lead. */
export function LeadLineDetails({
  code,
  values,
  dob,
  carriers,
  sensitiveByKey,
  canReveal,
  hidden,
}: {
  code: LineCode;
  values: LineValues;
  dob?: string;
  carriers: { id: string; name: string }[];
  sensitiveByKey: Record<string, RestrictedItem>;
  canReveal: boolean;
  /** Visibilidad por persona: secciones/campos ocultos para quien mira. */
  hidden?: Set<string>;
}) {
  const def = LINE_DEFS[code];
  return (
    <div className="space-y-5">
      {def.sections.filter((section) => !hidden?.has(`lead.${code}.${section.id}`)).map((section) => {
        const restricted: RestrictedItem[] = [];
        const rows = section.fields.filter(
          (f) => isFieldVisible(f, values) && !hidden?.has(`lead.${code}.${section.id}.${f.key}`)
        );
        return (
          <div key={section.id}>
            <h4 className="mb-2 text-xs font-semibold uppercase text-[var(--ink-muted)]">{section.title}</h4>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {rows.map((f) => {
                if (f.kind === "sensitive") {
                  const item = sensitiveByKey[sensitiveKeyFor(code, f.key)];
                  if (item) restricted.push({ ...item, label: f.label });
                  else restricted.push({ id: `missing-${f.key}`, label: f.label, maskedPreview: "—" });
                  return null;
                }
                if (f.kind === "turning65") {
                  return (
                    <div key={f.key} className="sm:col-span-2">
                      <dt className="mb-1 text-xs text-[var(--ink-muted)]">{f.label}</dt>
                      <Turning65Alert dob={dob ?? ""} />
                    </div>
                  );
                }
                if (f.kind === "computed-age") {
                  const age = ageFromDob(dob);
                  return <Row key={f.key} label={f.label} value={age != null ? `${age} años` : ""} />;
                }
                if (f.kind === "carrier") {
                  return <Row key={f.key} label={f.label} value={carriers.find((c) => c.id === values[f.key])?.name ?? ""} full={f.full} />;
                }
                if (f.kind === "signature") {
                  const src = String(values[f.key] ?? "");
                  return (
                    <div key={f.key} className="sm:col-span-2">
                      <dt className="text-xs text-[var(--ink-muted)]">{f.label}</dt>
                      <dd className="mt-1">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt="Firma" className="h-20 rounded border border-[var(--border-hairline)] bg-white" />
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                  );
                }
                if (f.kind === "list") {
                  const items = (values[f.key] as ListItem[]) ?? [];
                  const none = values[noneKey(f.key)] === true;
                  const subs = (f.itemFields ?? []).filter((s) => s.kind !== "sensitive");
                  const sensSubs = (f.itemFields ?? []).filter((s) => s.kind === "sensitive");
                  return (
                    <div key={f.key} className="sm:col-span-2">
                      <dt className="mb-1 text-xs text-[var(--ink-muted)]">{f.label}</dt>
                      <dd>
                        {items.length === 0 ? (
                          <span className="font-medium">{none ? f.noneLabel : "—"}</span>
                        ) : (
                          <HScroll className="rounded-lg border border-[var(--border-hairline)]" innerClassName="rounded-lg">
                            <table className="w-full text-sm">
                              <thead className="bg-[var(--surface-sunken)] text-xs text-[var(--ink-muted)]">
                                <tr>
                                  {subs.map((s) => (
                                    <th key={s.key} className="px-3 py-1.5 text-left font-medium">
                                      {s.label}
                                    </th>
                                  ))}
                                  {sensSubs.map((s) => (
                                    <th key={s.key} className="px-3 py-1.5 text-left font-medium">
                                      {s.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((it) => (
                                  <tr key={it._id} className="border-t border-[var(--border-grid)]">
                                    {subs.map((s) => (
                                      <td key={s.key} className="px-3 py-1.5">
                                        {s.kind === "computed-age"
                                          ? (() => {
                                              const a = ageFromDob(it[s.fromKey ?? "dob"]);
                                              return a != null ? `${a} años` : "—";
                                            })()
                                          : displayValue(s, it[s.key]) || "—"}
                                      </td>
                                    ))}
                                    {sensSubs.map((s) => {
                                      const item = sensitiveByKey[sensitiveKeyFor(code, s.key, { listKey: f.key, itemId: it._id })];
                                      return (
                                        <td key={s.key} className="px-3 py-1.5">
                                          {item ? (
                                            <LeadRestrictedValue item={item} canReveal={canReveal} />
                                          ) : (
                                            "—"
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </HScroll>
                        )}
                      </dd>
                    </div>
                  );
                }
                return <Row key={f.key} label={f.label} value={displayValue(f, values[f.key])} full={f.full} />;
              })}
            </dl>
            {restricted.length > 0 && (
              <div className="mt-3">
                <LeadRestrictedPanel title={section.title} items={restricted.filter((r) => !r.id.startsWith("missing-"))} canReveal={canReveal} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-[var(--ink-muted)]">{label}</dt>
      <dd className="whitespace-pre-wrap font-medium">{value || "—"}</dd>
    </div>
  );
}
