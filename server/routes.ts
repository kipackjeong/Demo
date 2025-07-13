import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { setupWebSocketServer } from "./services/websocket";
import { mcpUnifiedServer as mcpServer } from "./services/mcpUnified";
import { setupAuth, requireAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  setupAuth(app);

  // Basic API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Auth routes
  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });

  // Check Google integration status
  app.get("/api/auth/google-status", requireAuth, async (req, res) => {
    const user = req.user as User;
    res.json({
      hasGoogleAccount: !!user.googleId,
      hasAccessToken: !!user.googleAccessToken,
      hasRefreshToken: !!user.googleRefreshToken,
      needsReauthorization: !!user.googleId && !user.googleRefreshToken
    });
  });

  // Revoke Google access to force refresh token on next login
  app.post("/api/auth/google/revoke", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Clear Google tokens from user
      await storage.updateUser(user.id, {
        googleAccessToken: null,
        googleRefreshToken: null,
        googleId: null
      });
      
      res.json({ message: "Google access revoked. Please re-authorize to get a new refresh token." });
    } catch (error) {
      console.error("Error revoking Google access:", error);
      res.status(500).json({ error: "Failed to revoke Google access" });
    }
  });

  // Manually set refresh token (for testing/debugging)
  app.post("/api/auth/google/set-refresh-token", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
      }
      
      // Update user with refresh token
      await storage.updateUser(user.id, {
        googleRefreshToken: refreshToken
      });
      
      console.log(`Manually set refresh token for user ${user.email}`);
      res.json({ message: "Refresh token set successfully" });
    } catch (error) {
      console.error("Error setting refresh token:", error);
      res.status(500).json({ error: "Failed to set refresh token" });
    }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    const passport = require("passport");
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(400).json({ message: info?.message || "Invalid credentials" });
      
      req.logIn(user, (err) => {
        if (err) return next(err);
        res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      // Create new user
      const user = await storage.createUser({
        email,
        password,
        firstName,
        lastName,
      });
      
      req.logIn(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out successfully" });
    });
  });

  // Google OAuth routes
  app.get("/api/auth/google", async (req, res, next) => {
    const passport = require("passport");
    // Force re-authorization if user needs refresh token
    const forceConsent = req.query.force === 'true';
    
    const authOptions: any = {
      scope: [
        "profile", 
        "email",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/tasks",
        "https://www.googleapis.com/auth/tasks.readonly"
      ],
      accessType: 'offline',
      includeGrantedScopes: true
    };
    
    if (forceConsent) {
      authOptions.prompt = 'consent';
      authOptions.approval_prompt = 'force'; // This forces refresh token
      authOptions.state = 'force_consent';
    } else {
      authOptions.prompt = 'select_account';
    }
    
    console.log("Google OAuth auth options:", authOptions);
    
    passport.authenticate("google", authOptions)(req, res, next);
  });

  app.get("/api/auth/google/callback", async (req, res, next) => {
    const passport = require("passport");
    passport.authenticate("google", {
      successRedirect: "/",
      failureRedirect: "/auth",
    })(req, res, next);
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
      // Force HTTPS for Replit deployments
      const redirectUri = `https://${req.get('host')}/api/google/callback`;
      
      mcpServer.configure({
        clientId,
        clientSecret,
        redirectUri,
        refreshToken: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || process.env.GOOGLE_TASKS_REFRESH_TOKEN,
        accessToken: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN || process.env.GOOGLE_TASKS_ACCESS_TOKEN,
      });
      
      const calendarAuthUrl = mcpServer.getCalendarAuthUrl();
      const tasksAuthUrl = mcpServer.getCalendarAuthUrl(); // Same URL for both since we request both scopes
      
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
      
      // Handle callback for both services with unified handler
      const tokens = await mcpServer.handleAuthCallback(code as string);
      
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
      
      const calendars = await mcpServer.listCalendarsDirectly();
      const taskLists = await mcpServer.getTaskListsDirectly();
      
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
