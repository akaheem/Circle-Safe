"use client";

import { useEffect, useRef, useState } from "react";
import { API_MODE } from "./api";
import { getSession } from "./auth";

export type LiveStatus = "connecting" | "live" | "offline" | "demo";

/**
 * Subscribes to live circle updates and calls `onUpdate` when one arrives, so the caller
 * refetches. Two transports, one message shape (`{ action: "circle_update" }`):
 *
 * - **Sub0**: its native WebSocket. Every mutating endpoint fires
 *   `broadcast_websocket_message` (see backend/endpoints/realtime/README.md). Set
 *   `NEXT_PUBLIC_WS_URL`, e.g. `wss://<sub0-host>/ws`.
 * - **Self-hosted**: Server-Sent Events at `/api/events`, fed by the same broadcast call in
 *   `lib/server/events.ts`. Used automatically when `NEXT_PUBLIC_LOCAL_API=true`.
 *
 * In mock mode there's nothing to subscribe to and the UI refreshes on user actions.
 */
export function useLive(onUpdate: () => void): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>(
    API_MODE === "mock" ? "demo" : "connecting",
  );
  const handler = useRef(onUpdate);
  handler.current = onUpdate;

  useEffect(() => {
    if (API_MODE === "mock") return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;

    /* ---------------- Sub0: native WebSocket ---------------- */
    if (wsUrl) {
      const session = getSession();
      const url = `${wsUrl}${wsUrl.includes("?") ? "&" : "?"}uid=${encodeURIComponent(
        session?.user.id ?? "anon",
      )}`;

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
    }

    /* ------------- Self-hosted: Server-Sent Events ------------- */
    if (API_MODE === "local" || API_MODE === "sub0") {
      const token = getSession()?.token;
      if (!token) {
        setStatus("offline");
        return;
      }

      // In local mode the SSE stream is same-origin (`/api/events`). In sub0 mode (frontend on
      // Vercel, API on Render) it is cross-origin — derive the base from API_URL. API_URL already
      // ends in /api (matching how the sub0 mode sends API calls), so the SSE path is just /events.
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
      const baseUrl = API_MODE === "local" ? "" : apiUrl.replace(/\/api\/?$/, "");
      const url = `${baseUrl}/api/events?token=${encodeURIComponent(token)}`;

      // EventSource reconnects on its own, so no manual backoff needed here.
      const source = new EventSource(url);

      source.onopen = () => setStatus("live");
      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.action === "circle_update") handler.current();
        } catch {
          /* ignore keep-alive comments */
        }
      };
      source.onerror = () => setStatus("offline");

      return () => source.close();
    }

    // Sub0 mode without NEXT_PUBLIC_WS_URL: data still loads, just no push.
    setStatus("offline");
  }, []);

  return status;
}
