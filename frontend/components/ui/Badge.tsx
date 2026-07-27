const TONES: Record<string, string> = {
  ACTIVE: "bg-primary/12 text-primary",
  PENDING: "bg-accent/15 text-accent-dark",
  COMPLETED: "bg-muted/15 text-muted",
  CONFIRMED: "bg-primary/12 text-primary",
  PAID: "bg-primary/12 text-primary",
  RECEIVED: "bg-primary/12 text-primary",
  INVITED: "bg-accent/15 text-accent-dark",
  OWNER: "bg-primary/12 text-primary",
  TREASURER: "bg-accent/15 text-accent-dark",
  MEMBER: "bg-muted/15 text-muted",
};

export default function Badge({ value }: { value: string }) {
  const tone = TONES[value] ?? "bg-muted/15 text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {value}
    </span>
  );
}
