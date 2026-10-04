"use client";

import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";
import { HScroll } from "@/components/ui/HScroll";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ tabs, defaultTab }: { tabs: Tab[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const activeTab = tabs.find((t) => t.id === active);

  return (
    <div>
      <HScroll size="sm" className="border-b border-[var(--border-grid)]" innerClassName="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
              active === tab.id
                ? "border-[var(--brand-500)] text-[var(--brand-500)]"
                : "border-transparent text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </HScroll>
      <div key={active} className="animate-kosmo-fade-in-up pt-4">
        {activeTab?.content}
      </div>
    </div>
  );
}
