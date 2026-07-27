type Tone = "error" | "success" | "info";

const TONES: Record<Tone, string> = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-primary/25 bg-primary/8 text-primary-dark",
  info: "border-accent/30 bg-accent/10 text-accent-dark",
};

export default function Alert({
  tone = "info",
  children,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${TONES[tone]} ${className}`}>{children}</div>
  );
}
