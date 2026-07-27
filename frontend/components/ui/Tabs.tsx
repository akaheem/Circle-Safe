"use client";

import type { LucideIcon } from "lucide-react";

export interface TabDef {
  key: string;
  label: string;
  icon?: LucideIcon;
}

interface TabsProps {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <div role="tablist" className="flex min-w-max gap-1 border-b border-line px-1">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => onChange(t.key)}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                on
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:border-line hover:text-body"
              }`}
            >
              {t.icon && <t.icon size={16} />}
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
