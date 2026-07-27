import { useEffect, useState } from "react";
import type { User } from "./types";

const SESSION_KEY = "circlesafe_session";

interface Session {
  token: string;
  user: User;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(user: User): void {
  if (typeof window === "undefined") return;
  const token = user.token ?? "";
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}

/** Client hook: current user + a readiness flag (avoids hydration flash). */
export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(getSession()?.user ?? null);
    setReady(true);
  }, []);

  return { user, ready };
}
