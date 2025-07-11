import { WebSocketServer, WebSocket } from "ws";
import type { IStorage } from "../storage";
import { AgentService } from "./agent";
import type { WebSocketMessage } from "@shared/schema";

export function setupWebSocketServer(wss: WebSocketServer, storage: IStorage) {
  const agentService = new AgentService();

  console.log("Setting up WebSocket server listeners...");

  wss.on("connection", (ws: WebSocket, req) => {
    console.log("New WebSocket connection established from:", req.socket.remoteAddress);
    console.log("Connection headers:", req.headers);

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
        await handleWebSocketMessage(ws, message, storage, agentService);
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
  agentService: AgentService
) {
  if (message.type === "user_message") {
    // Store user message
    await storage.addMessage({
      sessionId: message.sessionId,
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
      
      // Stream the response
      await streamResponse(ws, response, message.sessionId, storage);
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
  }
}

async function streamResponse(
  ws: WebSocket,
  response: string,
  sessionId: string,
  storage: IStorage
) {
  const words = response.split(" ");
  let currentContent = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentContent += (i > 0 ? " " : "") + word;

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "agent_response",
        content: word + (i < words.length - 1 ? " " : ""),
        sessionId,
        role: "assistant",
      }));
    }

    // Add delay to simulate streaming
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Store the complete response
  await storage.addMessage({
    sessionId,
    role: "assistant",
    content: response,
  });

  // Send done signal
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "done",
      sessionId,
    }));
  }
}
