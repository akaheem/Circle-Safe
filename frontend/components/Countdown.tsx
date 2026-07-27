"use client";

import { useEffect, useState } from "react";

export type CountdownMode = "start" | "expiry";

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

const WORDS: Record<CountdownMode, { ahead: string; imminent: string; past: string }> = {
  start: { ahead: "starts in", imminent: "starting now", past: "started" },
  expiry: { ahead: "expires in", imminent: "expires shortly", past: "expired" },
};

/** The size of a gap, coarse to fine: "4d 3h", "2h 15m", "45m", "30s". */
export function formatGap(ms: number): string {
  const abs = Math.abs(ms);
  if (abs >= DAY) {
    const d = Math.floor(abs / DAY);
    const h = Math.floor((abs % DAY) / HOUR);
    return h ? `${d}d ${h}h` : `${d}d`;
  }
  if (abs >= HOUR) {
    const h = Math.floor(abs / HOUR);
    const m = Math.floor((abs % HOUR) / MINUTE);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  if (abs >= MINUTE) return `${Math.floor(abs / MINUTE)}m`;
  return `${Math.max(1, Math.round(abs / 1000))}s`;
}

/** "starts in 4d 3h" / "starts in 2h 15m" / "starting now" / "started". */
export function countdownLabel(
  iso?: string | null,
  mode: CountdownMode = "start",
  at: number = Date.now(),
): string {
  if (!iso) return "";
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "";

  const gap = target - at;
  const words = WORDS[mode];
  if (gap <= 0) return -gap < MINUTE ? words.imminent : words.past;
  if (gap < MINUTE) return words.imminent;
  return `${words.ahead} ${formatGap(gap)}`;
}

interface CountdownProps {
  /** ISO timestamp being counted towards. */
  at?: string | null;
  mode?: CountdownMode;
  className?: string;
}

export default function Countdown({ at, mode = "start", className = "" }: CountdownProps) {
  const target = at ? new Date(at).getTime() : NaN;
  const [now, setNow] = useState(() => Date.now());

  const valid = !Number.isNaN(target);
  // Under an hour the label changes every minute, so tick per second; a minute is plenty otherwise.
  const fine = valid && target - now < HOUR;
  // Once the moment has passed the label is fixed, so stop burning a timer on it.
  const settled = valid && now - target > MINUTE;

  useEffect(() => {
    if (!valid || settled) return;
    const id = setInterval(() => setNow(Date.now()), fine ? 1000 : MINUTE);
    return () => clearInterval(id);
  }, [valid, settled, fine, target]);

  const label = countdownLabel(at, mode, now);
  if (!label) return null;
  return <span className={className}>{label}</span>;
}
