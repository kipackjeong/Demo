import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { setupWebSocketServer } from "./services/websocket";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

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
