import { useEffect, useState, useRef, useCallback } from "react";
import type { WebSocketMessage } from "@shared/schema";

type ConnectionStatus = "connected" | "connecting" | "disconnected";

interface UseWebSocketOptions {
  url: string;
  onMessage: (message: WebSocketMessage) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export function useWebSocket({
  url,
  onMessage,
  reconnectAttempts = 3,
  reconnectInterval = 2000
}: UseWebSocketOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, "Component unmounted");
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    
    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setConnectionStatus("connecting");
    setError(null);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}${url}`;
    
    console.log("Connecting to WebSocket:", wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      console.log("WebSocket connected successfully");
      setConnectionStatus("connected");
      reconnectCountRef.current = 0;
      setError(null);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === "connected") {
          return; // Skip connection confirmation messages
        }
        onMessage(message);
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
        setError("Failed to parse message");
      }
    };

    ws.onclose = (event) => {
      if (!mountedRef.current) return;
      console.log("WebSocket disconnected:", event.code);
      setConnectionStatus("disconnected");
      wsRef.current = null;

      // Only reconnect for unexpected closures
      if (event.code !== 1000 && reconnectCountRef.current < reconnectAttempts) {
        reconnectCountRef.current++;
        console.log(`Reconnecting in ${reconnectInterval}ms (${reconnectCountRef.current}/${reconnectAttempts})`);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, reconnectInterval);
      } else if (reconnectCountRef.current >= reconnectAttempts) {
        setError("Connection failed after multiple attempts");
      }
    };

    ws.onerror = (error) => {
      if (!mountedRef.current) return;
      console.error("WebSocket error:", error);
      setError("Connection error");
    };
  }, [url, onMessage, reconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    cleanup();
    reconnectCountRef.current = 0;
    setConnectionStatus("disconnected");
    setError(null);
  }, [cleanup]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      setError("Not connected");
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [connect, cleanup]);

  return {
    connectionStatus,
    error,
    sendMessage,
    connect,
    disconnect
  };
}
