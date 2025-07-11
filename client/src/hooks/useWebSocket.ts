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
  reconnectAttempts = 5,
  reconnectInterval = 3000
}: UseWebSocketOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus("connecting");
    setError(null);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}${url}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connection opened");
      setConnectionStatus("connected");
      reconnectCountRef.current = 0;
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "connected") {
          console.log("WebSocket connection confirmed");
          return;
        }
        onMessage(message);
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
        setError("Failed to parse message");
      }
    };

    ws.onclose = (event) => {
      console.log("WebSocket connection closed:", event.code, event.reason);
      setConnectionStatus("disconnected");
      wsRef.current = null;

      // Only attempt to reconnect if not closed intentionally
      if (event.code !== 1000 && reconnectCountRef.current < reconnectAttempts) {
        reconnectCountRef.current++;
        console.log(`Attempting to reconnect (${reconnectCountRef.current}/${reconnectAttempts})`);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectInterval);
      } else if (reconnectCountRef.current >= reconnectAttempts) {
        setError("Maximum reconnection attempts reached");
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError("WebSocket connection error");
    };
  }, [url, onMessage, reconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }

    reconnectCountRef.current = 0;
    setConnectionStatus("disconnected");
    setError(null);
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      setError("WebSocket is not connected");
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connectionStatus,
    error,
    sendMessage,
    connect,
    disconnect
  };
}
