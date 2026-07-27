import type { LucideIcon } from "lucide-react";

export default function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
      {Icon && (
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon size={22} />
        </span>
      )}
      <h3 className="font-heading text-lg font-semibold">{title}</h3>
      {message && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{message}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
