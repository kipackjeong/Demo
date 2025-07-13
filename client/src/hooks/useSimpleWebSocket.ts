import { useEffect, useState, useRef } from "react";
import type { WebSocketMessage } from "@shared/schema";

type ConnectionStatus = "connected" | "connecting" | "disconnected";

interface UseSimpleWebSocketOptions {
  url: string;
  onMessage: (message: WebSocketMessage) => void;
  userId?: number;
}

export function useSimpleWebSocket({ url, onMessage, userId }: UseSimpleWebSocketOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);
  const maxReconnectAttempts = 3;

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus("connecting");
    setError(null);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}${url}`;
    
    console.log("Connecting to:", wsUrl);
    
    // Create WebSocket with custom headers if userId is available
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setConnectionStatus("connected");
      reconnectCountRef.current = 0;
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== "connected") {
          onMessage(message);
        }
      } catch (err) {
        console.error("Failed to parse message:", err);
      }
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code);
      setConnectionStatus("disconnected");
      wsRef.current = null;

      // Only reconnect for unexpected closures
      if (event.code !== 1000 && reconnectCountRef.current < maxReconnectAttempts) {
        reconnectCountRef.current++;
        console.log(`Reconnecting (${reconnectCountRef.current}/${maxReconnectAttempts})...`);
        reconnectTimeoutRef.current = setTimeout(connect, 2000);
      } else if (reconnectCountRef.current >= maxReconnectAttempts) {
        setError("Connection failed");
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError("Connection error");
    };
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000);
      wsRef.current = null;
    }
    setConnectionStatus("disconnected");
    setError(null);
    reconnectCountRef.current = 0;
  };

  const sendMessage = (message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      setError("Not connected");
    }
  };

  useEffect(() => {
    connect();
    return disconnect;
  }, [url]); // Only reconnect when URL changes

  return {
    connectionStatus,
    error,
    sendMessage,
    connect,
    disconnect
  };
}