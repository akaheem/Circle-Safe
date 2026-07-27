const SYMBOLS: Record<string, string> = {
  NGN: "₦", GHS: "₵", KES: "KSh", ZAR: "R", USD: "$", EUR: "€", GBP: "£", XOF: "CFA", XAF: "CFA",
};

export function currencySymbol(code: string): string {
  return SYMBOLS[code?.toUpperCase()] ?? (code ? code + " " : "");
}

export function formatMoney(amount: number, currency = "NGN"): string {
  const n = Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `${currencySymbol(currency)}${n}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function timeAgo(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}
