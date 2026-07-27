"use client";

import { useEffect, useRef, useState } from "react";
import { USE_MOCK } from "./api";
import { getSession } from "./auth";

export type LiveStatus = "connecting" | "live" | "offline" | "demo";

/**
 * Subscribes to Sub0's native WebSocket feed. Every mutating CircleSafe endpoint
 * broadcasts `{ action: "circle_update" }` (see backend/endpoints/realtime/README.md);
 * when one arrives we invoke `onUpdate` so the caller re-fetches its data.
 *
 * URL comes from NEXT_PUBLIC_WS_URL (e.g. wss://<sub0-host>/ws). Without it we stay
 * in demo mode and the UI simply refreshes on user actions.
 */
export function useLive(onUpdate: () => void): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>(USE_MOCK ? "demo" : "connecting");
  const handler = useRef(onUpdate);
  handler.current = onUpdate;

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_WS_URL;
    if (!base || USE_MOCK) return;

    const session = getSession();
    const url = `${base}${base.includes("?") ? "&" : "?"}uid=${encodeURIComponent(session?.user.id ?? "anon")}`;

    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      // Protected sockets take the JWT as a subprotocol (Sub0 convention).
      socket = session?.token
        ? new WebSocket(url, ["x-access-token", session.token])
        : new WebSocket(url);

      socket.onopen = () => setStatus("live");
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.action === "circle_update") handler.current();
        } catch {
          /* ignore non-JSON frames */
        }
      };
      socket.onclose = () => {
        if (closed) return;
        setStatus("offline");
        retry = setTimeout(connect, 4000); // reconnect with a fixed backoff
      };
      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, []);

  return status;
}
