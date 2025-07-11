import { WebSocketServer, WebSocket } from "ws";
import type { IStorage } from "../storage";
import { AgentService } from "./agent";
import type { WebSocketMessage } from "@shared/schema";

export function setupWebSocketServer(wss: WebSocketServer, storage: IStorage) {
  const agentService = new AgentService();

  wss.on("connection", (ws: WebSocket) => {
    console.log("New WebSocket connection established");

    // Send initial connection success message immediately
    ws.send(JSON.stringify({
      type: "connected",
      sessionId: "",
    }));

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

    // Generate agent response
    try {
      const response = await agentService.generateResponse(message.content || "");
      
      // Stream the response
      await streamResponse(ws, response, message.sessionId, storage);
    } catch (error) {
      console.error("Error generating agent response:", error);
      ws.send(JSON.stringify({
        type: "error",
        content: "Failed to generate response",
        sessionId: message.sessionId,
      }));
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
