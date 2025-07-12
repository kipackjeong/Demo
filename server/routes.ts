import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { setupWebSocketServer } from "./services/websocket";

export async function registerRoutes(app: Express): Promise<Server> {
  // Basic API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const httpServer = createServer(app);
  
  // Setup WebSocket server with more explicit configuration
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: "/chat-ws",
    perMessageDeflate: false,
    clientTracking: true
  });
  
  console.log("WebSocket server initialized on path /chat-ws");
  
  setupWebSocketServer(wss, storage);

  return httpServer;
}
