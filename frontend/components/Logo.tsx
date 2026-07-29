/**
 * CircleSafe mark.
 *
 * An open ring (the rotation), a gold bead where the pot currently sits, and a
 * check for the two-party confirmation every contribution needs. Palette is the
 * Savanna Trust set from tailwind.config.ts. Kept in sync with app/icon.svg,
 * which is the favicon — regenerate the raster icons with `npm run icons`.
 */
export default function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="CircleSafe">
      <defs>
        <linearGradient id="csTile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34E0A1" />
          <stop offset="0.55" stopColor="#0FA968" />
          <stop offset="1" stopColor="#0B8452" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#csTile)" />
      <circle
        cx="32"
        cy="32"
        r="17"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeDasharray="85.4 21.4"
      />
      <path
        d="M24.5 32.8 L29.8 38 L39.5 26.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="37.25" cy="15.85" r="5.4" fill="#F5B301" />
    </svg>
  );
}
