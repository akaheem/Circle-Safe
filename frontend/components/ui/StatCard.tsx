import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "primary" | "accent" | "neutral";
}

const TONES = {
  primary: "bg-primary/12 text-primary",
  accent: "bg-accent/15 text-accent-dark",
  neutral: "bg-muted/12 text-muted",
};

export default function StatCard({ label, value, hint, icon: Icon, tone = "primary" }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted">{label}</span>
        {Icon && (
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONES[tone]}`}>
            <Icon size={17} />
          </span>
        )}
      </div>
      <div className="mt-2 font-heading text-2xl font-bold leading-tight text-body">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}
