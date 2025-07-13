import { WebSocketServer, WebSocket } from "ws";
import type { IStorage } from "../storage";
import { AgentService } from "./agent";
import type { WebSocketMessage } from "@shared/schema";
import { mcpServer } from "./mcpServer";
import { mcpUnifiedServer } from "./mcpUnified";
import { parse } from "cookie";
import session from "express-session";

// Store AgentService instances per session to maintain conversation history
const agentServiceMap = new Map<string, AgentService>();

// Track active message processing to prevent duplicates
const activeMessages = new Map<string, Promise<void>>();

export function setupWebSocketServer(wss: WebSocketServer, storage: IStorage) {
  // AgentService will be created per connection with user context

  console.log("Setting up WebSocket server listeners...");

  wss.on("connection", async (ws: WebSocket, req) => {
    console.log("New WebSocket connection established from:", req.socket.remoteAddress);
    console.log("Connection headers:", req.headers);

    // We'll get user info from the message itself since WebSocket doesn't share Express session easily
    let userId: number | null = null;
    let user: any = null;
    let agentService: AgentService = new AgentService();

    // Send initial connection success message immediately
    try {
      const connectMessage = JSON.stringify({
        type: "connected",
        sessionId: "",
      });
      ws.send(connectMessage);
      console.log("Sent connection confirmation message:", connectMessage);
    } catch (error) {
      console.error("Error sending connection confirmation:", error);
    }

    ws.on("message", async (data) => {
      try {
        console.log("Received WebSocket message:", data.toString());
        const message: WebSocketMessage = JSON.parse(data.toString());
        await handleWebSocketMessage(ws, message, storage, userId || undefined);
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "error",
            content: "Failed to process message",
            sessionId: "",
          }));
        }
      }
    });

    ws.on("close", (code, reason) => {
      console.log("WebSocket connection closed:", code, reason.toString());
      if (code === 1001) {
        console.log("Connection closed unexpectedly - possible client issue");
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });

    ws.on("ping", () => {
      console.log("WebSocket ping received");
    });

    ws.on("pong", () => {
      console.log("WebSocket pong received");
    });
  });

  wss.on("error", (error) => {
    console.error("WebSocket server error:", error);
  });

  // Add server-level handling for upgrade requests
  wss.on("headers", (headers, req) => {
    console.log("WebSocket upgrade headers being sent to client");
  });

  // Add server listening event
  wss.on("listening", () => {
    console.log("WebSocket server is listening and ready to accept connections");
  });
}

async function handleWebSocketMessage(
  ws: WebSocket,
  message: WebSocketMessage,
  storage: IStorage,
  userId?: number
) {
  if (message.type === "user_message") {
    // Create a unique key for this message to prevent duplicate processing
    // Use content hash instead of timestamp to catch duplicates sent close together
    const contentHash = Buffer.from(message.content || "").toString('base64').substring(0, 20);
    const messageKey = `${message.sessionId}-${contentHash}`;
    
    // Check if this message is already being processed or was recently processed
    if (activeMessages.has(messageKey)) {
      console.log(`Duplicate message detected for session ${message.sessionId}, ignoring...`);
      return;
    }
    
    // Create a promise for this message processing
    const messagePromise = (async () => {
      try {
    // Get or create AgentService instance for this session
    let agentService = agentServiceMap.get(message.sessionId);
    
    // Get user from message if provided
    let user = null;
    if (message.userId) {
      userId = message.userId;
      user = await storage.getUser(userId);
      
      // Only create a new agent service if we don't have one or if user context changed
      if (!agentService) {
        // Configure MCP server and create new agent service with user context
        if (user?.googleAccessToken) {
          mcpServer.configureWithUserTokens(user);
          mcpUnifiedServer.configureWithUserTokens(user);
          agentService = new AgentService(user);
          console.log("Configured services with Google tokens for user:", user.email);
          console.log("Token status - Access: Present, Refresh:", user.googleRefreshToken ? "Present" : "Missing (will use access token only)");
        } else {
          console.log("User tokens status:", {
            email: user?.email,
            hasAccessToken: !!user?.googleAccessToken,
            hasRefreshToken: !!user?.googleRefreshToken
          });
          console.log("No Google access token - will use mock data");
          // Configure MCP server to use mock data
          mcpUnifiedServer.configure({
            clientId: '',
            clientSecret: '',
            redirectUri: '',
          }, true);
          agentService = new AgentService(user);
        }
        
        // Store the agent service for this session
        agentServiceMap.set(message.sessionId, agentService);
        console.log(`Created new AgentService for session: ${message.sessionId}`);
      }
    } else if (!agentService) {
      // No user context and no existing agent service, create a default one
      agentService = new AgentService();
      agentServiceMap.set(message.sessionId, agentService);
      console.log(`Created default AgentService for session: ${message.sessionId}`);
    }
    
    // Store user message
    await storage.addMessage({
      sessionId: message.sessionId,
      userId: userId || null,
      role: "user",
      content: message.content || "",
    });

    // Ensure chat session exists
    const existingSession = await storage.getChatSession(message.sessionId);
    if (!existingSession) {
      await storage.createChatSession({
        sessionId: message.sessionId,
        userId: null,
      });
    }

    // Send typing indicator
    ws.send(JSON.stringify({
      type: "typing",
      sessionId: message.sessionId,
    }));

    // Generate agent response with session context
    try {
      console.log("Starting agent response generation...");
      const response = await agentService.generateResponse(message.content || "", message.sessionId);
      console.log("Agent response generated, starting stream...");
      
      // Check if this is an initial summary
      const isInitialSummary = message.content?.includes('[INITIAL_SUMMARY]');
      
      // Stream the response
      await streamResponse(ws, response, message.sessionId, storage, isInitialSummary);
      console.log("Response streaming completed");
    } catch (error) {
      console.error("Error generating agent response:", error);
      console.error("Error stack:", error.stack);
      
      // Send error response
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "error",
          content: "Failed to generate response: " + error.message,
          sessionId: message.sessionId,
        }));
      }
    }
      } finally {
        // Keep the message key for a short time to catch late duplicates
        setTimeout(() => {
          activeMessages.delete(messageKey);
        }, 5000); // Remove after 5 seconds
      }
    })();
    
    // Store the promise to prevent duplicate processing
    activeMessages.set(messageKey, messagePromise);
    
    // Wait for the message to be processed
    await messagePromise;
  }
}

async function streamResponse(
  ws: WebSocket,
  response: string,
  sessionId: string,
  storage: IStorage,
  isInitialSummary: boolean = false
) {
  console.log(`Starting stream response. Response length: ${response.length}, Is initial summary: ${isInitialSummary}`);
  console.log(`First 200 chars of response: ${response.substring(0, 200)}...`);
  
  const words = response.split(" ");
  let currentContent = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentContent += (i > 0 ? " " : "") + word;

    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({
          type: "agent_response",
          content: word + (i < words.length - 1 ? " " : ""),
          sessionId,
          role: "assistant",
        }));
      } catch (error) {
        console.error("Error sending word:", error);
        break;
      }
    } else {
      console.log(`WebSocket closed at word ${i} of ${words.length}. State: ${ws.readyState}`);
      break;
    }

    // Add delay to simulate streaming
    await new Promise(resolve => setTimeout(resolve, 20)); // Further reduced delay
  }
  
  console.log(`Finished streaming ${words.length} words`);
  
  // Small delay before sending done signal
  await new Promise(resolve => setTimeout(resolve, 100));

  // Store the complete response
  await storage.addMessage({
    sessionId,
    userId: null, // Will be updated with actual user ID
    role: "assistant",
    content: response,
  });

  // Send done signal
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "done",
      sessionId,
    }));
    
    // If this is an initial summary, send action buttons for different time ranges
    if (isInitialSummary) {
      ws.send(JSON.stringify({
        type: "action_buttons",
        sessionId,
        buttons: [
          {
            id: "this_week",
            label: "Get this week's schedule",
            action: "Show me my schedule for this week"
          },
          {
            id: "this_month", 
            label: "Get this month's schedule",
            action: "Show me my schedule for this month"
          },
          {
            id: "all_tasks",
            label: "Show all tasks",
            action: "Show me all my tasks organized by priority"
          },
          {
            id: "upcoming_7days",
            label: "Next 7 days",
            action: "Show me my schedule for the next 7 days"
          }
        ]
      }));
    }
  }
}
