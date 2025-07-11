import { useEffect, useState, useRef } from "react";
import type { WebSocketMessage } from "@shared/schema";

export function useMinimalWebSocket(url: string, onMessage: (message: WebSocketMessage) => void) {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!mountedRef.current) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}${url}`;
    
    console.log("Connecting to WebSocket:", wsUrl);
    setStatus("connecting");
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current) {
        console.log("WebSocket opened successfully");
        setError(null);
        setStatus("connected");
      }
    };

    ws.onmessage = (event) => {
      if (mountedRef.current) {
        try {
          const message = JSON.parse(event.data);
          console.log("Received WebSocket message:", message);
          onMessage(message);
        } catch (err) {
          console.error("Message parse error:", err);
        }
      }
    };

    ws.onclose = (event) => {
      if (mountedRef.current) {
        console.log("WebSocket closed:", event.code, event.reason);
        setStatus("disconnected");
        wsRef.current = null;
      }
    };

    ws.onerror = (error) => {
      if (mountedRef.current) {
        console.error("WebSocket error:", error);
        setError("Connection failed");
      }
    };

    return () => {
      mountedRef.current = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "Component unmounted");
      }
    };
  }, [url, onMessage]);

  const sendMessage = (message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  return { status, error, sendMessage };
}