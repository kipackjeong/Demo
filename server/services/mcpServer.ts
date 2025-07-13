import { mcpGoogleClient } from './mcpClient';
import { googleMCPServer } from './mcpGoogleServer';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

export interface MCPServerConfig {
  googleCalendar: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    refreshToken?: string;
    accessToken?: string;
  };
  googleTasks: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    refreshToken?: string;
    accessToken?: string;
  };
}

export class MCPServer {
  private isConfigured: boolean = false;
  private mcpServerProcess: ChildProcess | null = null;
  private currentUserTokens: { accessToken?: string; refreshToken?: string } | null = null;

  constructor(config?: MCPServerConfig) {
    if (config) {
      this.configure(config);
    } else {
      console.log("MCP Server wrapper created - waiting for user authentication");
    }
  }

  configure(config: MCPServerConfig): void {
    // Store tokens for the current user
    this.currentUserTokens = {
      accessToken: config.googleCalendar.accessToken,
      refreshToken: config.googleCalendar.refreshToken,
    };

    // Configure the embedded MCP server with credentials
    googleMCPServer.configure({
      clientId: config.googleCalendar.clientId,
      clientSecret: config.googleCalendar.clientSecret,
      redirectUri: config.googleCalendar.redirectUri,
      accessToken: config.googleCalendar.accessToken,
      refreshToken: config.googleCalendar.refreshToken,
    });

    this.isConfigured = true;
  }

  // Configure MCP server with user's Google tokens
  configureWithUserTokens(user: any) {
    // Use tokens if we have at least an access token
    if (user.googleAccessToken) {
      const config: MCPServerConfig = {
        googleCalendar: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          redirectUri: "/api/auth/google/callback",
          accessToken: user.googleAccessToken,
          refreshToken: user.googleRefreshToken, // May be undefined, that's OK
        },
        googleTasks: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          redirectUri: "/api/auth/google/callback",
          accessToken: user.googleAccessToken,
          refreshToken: user.googleRefreshToken, // May be undefined, that's OK
        },
      };
      this.configure(config);
      console.log(`MCP Server configured for user ${user.email} with access token. Refresh token: ${user.googleRefreshToken ? 'Present' : 'Missing'}`);
    }
  }

  isReady(): boolean {
    return this.isConfigured;
  }

  // Calendar operations
  async getCalendarEvents(calendarId?: string, timeMin?: string, timeMax?: string) {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    return this.calendarMCP.getEvents(calendarId, timeMin, timeMax);
  }

  async createCalendarEvent(calendarId: string | undefined, eventData: {
    title: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    location?: string;
    attendees?: string[];
    timeZone?: string;
  }) {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    return this.calendarMCP.createEvent(calendarId, eventData);
  }

  async updateCalendarEvent(calendarId: string | undefined, eventId: string, eventData: any) {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    return this.calendarMCP.updateEvent(calendarId, eventId, eventData);
  }

  async deleteCalendarEvent(calendarId: string | undefined, eventId: string) {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    return this.calendarMCP.deleteEvent(calendarId, eventId);
  }

  async listCalendars() {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    return this.calendarMCP.listCalendars();
  }

  // Tasks operations
  async getTasks(taskListId?: string) {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    return this.tasksMCP.getTasks(taskListId);
  }

  async createTask(taskListId: string, taskData: {
    title: string;
    description?: string;
    dueDate?: string;
    priority?: "high" | "medium" | "low";
  }) {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    return this.tasksMCP.createTask(taskListId, taskData);
  }

  async updateTask(taskListId: string, taskId: string, taskData: any) {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    return this.tasksMCP.updateTask(taskListId, taskId, taskData);
  }

  async deleteTask(taskListId: string, taskId: string) {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    return this.tasksMCP.deleteTask(taskListId, taskId);
  }

  async completeTask(taskListId: string, taskId: string) {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    return this.tasksMCP.completeTask(taskListId, taskId);
  }

  async getTaskLists() {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    return this.tasksMCP.getTaskLists();
  }

  // Authentication URLs
  getCalendarAuthUrl(): string {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    return this.calendarMCP.generateAuthUrl();
  }

  getTasksAuthUrl(): string {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    return this.tasksMCP.generateAuthUrl();
  }

  // Handle auth callbacks
  async handleCalendarAuthCallback(code: string) {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    return this.calendarMCP.handleAuthCallback(code);
  }

  async handleTasksAuthCallback(code: string) {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    return this.tasksMCP.handleAuthCallback(code);
  }
}

// Singleton instance
export const mcpServer = new MCPServer();