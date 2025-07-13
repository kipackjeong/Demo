import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { setupWebSocketServer } from "./services/websocket";
import { mcpServer } from "./services/mcpServer";

export async function registerRoutes(app: Express): Promise<Server> {
  // Basic API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Google API OAuth setup and callback routes
  app.get("/api/google/setup", async (req, res) => {
    try {
      // Check if we have client credentials
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        return res.status(400).json({ 
          error: "Google API credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables." 
        });
      }
      
      // Configure MCP server with available credentials
      const redirectUri = `${req.protocol}://${req.get('host')}/api/google/callback`;
      
      mcpServer.configure({
        googleCalendar: {
          clientId,
          clientSecret,
          redirectUri,
          refreshToken: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
          accessToken: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN,
        },
        googleTasks: {
          clientId,
          clientSecret,
          redirectUri,
          refreshToken: process.env.GOOGLE_TASKS_REFRESH_TOKEN,
          accessToken: process.env.GOOGLE_TASKS_ACCESS_TOKEN,
        }
      });
      
      const calendarAuthUrl = mcpServer.getCalendarAuthUrl();
      const tasksAuthUrl = mcpServer.getTasksAuthUrl();
      
      res.json({
        message: "Google API setup URLs generated",
        calendarAuthUrl,
        tasksAuthUrl,
        redirectUri,
        setupInstructions: {
          step1: "Go to https://console.cloud.google.com/",
          step2: "Create a new project or select existing one",
          step3: "Enable Google Calendar API and Google Tasks API",
          step4: "Go to 'Credentials' and create OAuth 2.0 Client ID",
          step5: "Set application type to 'Web application'",
          step6: `Add this redirect URI: ${redirectUri}`,
          step7: "Copy the Client ID and Client Secret to your environment variables",
          step8: "Visit the auth URLs below to get refresh tokens"
        }
      });
    } catch (error) {
      console.error("Error setting up Google API:", error);
      res.status(500).json({ error: "Failed to setup Google API" });
    }
  });

  app.get("/api/google/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code) {
        return res.status(400).json({ error: "No authorization code received" });
      }
      
      // Determine which service this is for based on state parameter
      const service = state === 'tasks' ? 'tasks' : 'calendar';
      
      let tokens;
      if (service === 'calendar') {
        tokens = await mcpServer.handleCalendarAuthCallback(code as string);
      } else {
        tokens = await mcpServer.handleTasksAuthCallback(code as string);
      }
      
      res.json({
        message: `${service} authentication successful`,
        service,
        instruction: `Add these to your environment variables:`,
        environmentVariables: {
          [`GOOGLE_${service.toUpperCase()}_REFRESH_TOKEN`]: tokens.refreshToken,
          [`GOOGLE_${service.toUpperCase()}_ACCESS_TOKEN`]: tokens.accessToken
        }
      });
    } catch (error) {
      console.error("Error handling Google callback:", error);
      res.status(500).json({ error: "Failed to handle authentication callback" });
    }
  });

  // Test Google API connection
  app.get("/api/google/test", async (req, res) => {
    try {
      if (!mcpServer.isReady()) {
        return res.status(400).json({ error: "MCP server not configured" });
      }
      
      const calendars = await mcpServer.listCalendars();
      const taskLists = await mcpServer.getTaskLists();
      
      res.json({
        message: "Google API connection successful",
        calendars: calendars.length,
        taskLists: taskLists.length,
        calendarNames: calendars.map(c => c.summary).slice(0, 3),
        taskListNames: taskLists.map(t => t.title).slice(0, 3)
      });
    } catch (error) {
      console.error("Error testing Google API:", error);
      res.status(500).json({ error: "Failed to test Google API connection" });
    }
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
