import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { setupWebSocketServer } from "./services/websocket";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Add middleware to handle WebSocket upgrade requests
  app.get("/chat-ws", (req, res) => {
    res.status(426).send("Upgrade Required - WebSocket endpoint");
  });
  
  // Setup WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: "/chat-ws" 
  });
  
  console.log("WebSocket server initialized on path /chat-ws");
  
  setupWebSocketServer(wss, storage);

  return httpServer;
}
