import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accessToken?: string;
  refreshToken?: string;
}

export class MCPGoogleClient {
  private client: Client;
  private isConnected: boolean = false;
  private tools: Tool[] = [];

  constructor() {
    this.client = new Client({
      name: "google-services-client",
      version: "1.0.0",
    }, {
      capabilities: {}
    });
  }

  async connect(serverUrl: string = "ws://localhost:3000") {
    try {
      const transport = new WebSocketClientTransport(new URL(serverUrl));
      await this.client.connect(transport);
      this.isConnected = true;
      
      // Get available tools
      const toolsResponse = await this.client.listTools();
      this.tools = toolsResponse.tools;
      
      console.log("Connected to MCP server, available tools:", this.tools.map(t => t.name));
    } catch (error) {
      console.error("Failed to connect to MCP server:", error);
      throw error;
    }
  }

  async disconnect() {
    if (this.isConnected) {
      await this.client.close();
      this.isConnected = false;
    }
  }

  // Calendar operations
  async getCalendarEvents(calendarId = "primary", timeMin?: string, timeMax?: string): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error("Not connected to MCP server");
    }

    const result = await this.client.callTool({
      name: "get_calendar_events",
      arguments: {
        calendarId,
        timeMin: timeMin || new Date().toISOString(),
        timeMax,
        maxResults: 100,
      },
    });

    return this.parseToolResult(result);
  }

  async createCalendarEvent(eventData: {
    title: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    location?: string;
    attendees?: string[];
    timeZone?: string;
  }): Promise<any> {
    if (!this.isConnected) {
      throw new Error("Not connected to MCP server");
    }

    const result = await this.client.callTool({
      name: "create_calendar_event",
      arguments: {
        calendarId: "primary",
        ...eventData,
      },
    });

    return this.parseToolResult(result);
  }

  // Task operations
  async getTaskLists(): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error("Not connected to MCP server");
    }

    const result = await this.client.callTool({
      name: "get_task_lists",
      arguments: {},
    });

    return this.parseToolResult(result);
  }

  async getTasks(taskListId = "@default", showCompleted = false): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error("Not connected to MCP server");
    }

    const result = await this.client.callTool({
      name: "get_tasks",
      arguments: {
        taskListId,
        showCompleted,
      },
    });

    return this.parseToolResult(result);
  }

  async createTask(taskListId: string, taskData: {
    title: string;
    notes?: string;
    due?: string;
  }): Promise<any> {
    if (!this.isConnected) {
      throw new Error("Not connected to MCP server");
    }

    const result = await this.client.callTool({
      name: "create_task",
      arguments: {
        taskListId,
        ...taskData,
      },
    });

    return this.parseToolResult(result);
  }

  async completeTask(taskListId: string, taskId: string): Promise<any> {
    if (!this.isConnected) {
      throw new Error("Not connected to MCP server");
    }

    const result = await this.client.callTool({
      name: "complete_task",
      arguments: {
        taskListId,
        taskId,
      },
    });

    return this.parseToolResult(result);
  }

  // Resource access
  async readResource(uri: string): Promise<any> {
    if (!this.isConnected) {
      throw new Error("Not connected to MCP server");
    }

    const result = await this.client.readResource({ uri });
    
    if (result.contents && result.contents.length > 0) {
      const content = result.contents[0];
      if (content.text) {
        return JSON.parse(content.text);
      }
    }
    
    return null;
  }

  // Helper to parse tool results
  private parseToolResult(result: CallToolResult): any {
    if (result.content && result.content.length > 0) {
      const content = result.content[0];
      if (content.type === "text" && content.text) {
        try {
          return JSON.parse(content.text);
        } catch {
          return content.text;
        }
      }
    }
    return null;
  }

  isReady(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const mcpGoogleClient = new MCPGoogleClient();