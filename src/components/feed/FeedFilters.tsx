"use client";

import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/Field";
import type { FeedFilter, FeedSortOrder } from "@/types";

const FILTERS: { value: FeedFilter; label: string }[] = [
  { value: "all", label: "Todo" },
  { value: "mentions", label: "Menciones" },
  { value: "mine", label: "Mis publicaciones" },
  { value: "system", label: "Eventos del sistema" },
];

export function FeedFilters({
  filter,
  sort,
  onFilterChange,
  onSortChange,
}: {
  filter: FeedFilter;
  sort: FeedSortOrder;
  onFilterChange: (filter: FeedFilter) => void;
  onSortChange: (sort: FeedSortOrder) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => onFilterChange(f.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.value
                ? "bg-[var(--brand-500)] text-white"
                : "bg-[var(--surface-sunken)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <Select value={sort} onChange={(e) => onSortChange(e.target.value as FeedSortOrder)} className="!h-8 w-auto text-xs">
        <option value="recent">Más recientes</option>
        <option value="oldest">Más antiguos</option>
        <option value="most_commented">Más comentados</option>
      </Select>
    </div>
  );
}
