interface ProgressBarProps {
  value: number;
  /** Rendered above the bar, on the left. */
  label?: string;
  /** Rendered above the bar, on the right. Defaults to the rounded percentage. */
  caption?: string;
  tone?: "primary" | "accent";
}

export default function ProgressBar({ value, label, caption, tone = "primary" }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const fill =
    tone === "accent"
      ? "bg-gradient-to-r from-accent to-accent-dark"
      : "bg-gradient-to-r from-primary to-primary-light";

  return (
    <div>
      {(label || caption !== undefined) && (
        <div className="mb-1.5 flex justify-between text-xs text-muted">
          <span>{label}</span>
          <span>{caption ?? `${Math.round(pct)}%`}</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div className={`h-full rounded-full transition-all duration-500 ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
