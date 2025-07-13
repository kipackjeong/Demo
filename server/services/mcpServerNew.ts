// Simplified MCP Server wrapper that uses the Model Context Protocol
// This integrates with the googleMCPServer to provide Google API access

import { googleMCPServer } from './mcpGoogleServer';
import { mockDataStore } from './mockDataStore';

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

export class MCPServerNew {
  private isConfigured: boolean = false;
  private credentials: any = null;

  constructor(config?: MCPServerConfig) {
    if (config) {
      this.configure(config);
    } else {
      console.log("MCP Server (new) created - waiting for user authentication");
    }
  }

  configure(config: MCPServerConfig): void {
    // Configure the MCP server with Google credentials
    this.credentials = {
      clientId: config.googleCalendar.clientId,
      clientSecret: config.googleCalendar.clientSecret,
      redirectUri: config.googleCalendar.redirectUri,
      accessToken: config.googleCalendar.accessToken,
      refreshToken: config.googleCalendar.refreshToken,
    };

    googleMCPServer.configure(this.credentials);
    this.isConfigured = true;
  }

  // Configure MCP server with user's Google tokens
  configureWithUserTokens(user: any) {
    if (user.googleAccessToken) {
      const config: MCPServerConfig = {
        googleCalendar: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          redirectUri: "/api/auth/google/callback",
          accessToken: user.googleAccessToken,
          refreshToken: user.googleRefreshToken,
        },
        googleTasks: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          redirectUri: "/api/auth/google/callback",
          accessToken: user.googleAccessToken,
          refreshToken: user.googleRefreshToken,
        },
      };
      this.configure(config);
      console.log(`MCP Server (new) configured for user ${user.email} with access token. Refresh token: ${user.googleRefreshToken ? 'Present' : 'Missing'}`);
    }
  }

  isReady(): boolean {
    return this.isConfigured;
  }

  // Calendar operations - these now use the MCP protocol internally
  async getCalendarEvents(calendarId?: string, timeMin?: string, timeMax?: string) {
    if (!this.isConfigured) {
      console.log('MCP Server not configured, using mock data');
      return mockDataStore.getCalendarEvents();
    }
    
    try {
      // Call the MCP server's internal method directly
      const result = await googleMCPServer['getCalendarEvents']({
        calendarId: calendarId || 'primary',
        timeMin: timeMin || new Date().toISOString(),
        timeMax,
        maxResults: 100
      });
      
      if (result.content && result.content[0]?.text) {
        return JSON.parse(result.content[0].text);
      }
      return [];
    } catch (error) {
      console.error("Error getting calendar events via MCP:", error);
      return mockDataStore.getCalendarEvents();
    }
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
    
    try {
      const result = await googleMCPServer['createCalendarEvent']({
        calendarId: calendarId || 'primary',
        ...eventData
      });
      
      if (result.content && result.content[0]?.text) {
        return JSON.parse(result.content[0].text);
      }
      throw new Error('Invalid response from MCP server');
    } catch (error) {
      console.error("Error creating calendar event via MCP:", error);
      throw error;
    }
  }

  async listCalendars() {
    // For now, return a default calendar list
    return [{ id: 'primary', summary: 'Primary Calendar' }];
  }

  // Tasks operations
  async getTasks(taskListId?: string) {
    if (!this.isConfigured) {
      console.log('MCP Server not configured, using mock data');
      return mockDataStore.getTasks();
    }
    
    try {
      const result = await googleMCPServer['getTasks']({
        taskListId: taskListId || '@default',
        showCompleted: false,
        maxResults: 100
      });
      
      if (result.content && result.content[0]?.text) {
        return JSON.parse(result.content[0].text);
      }
      return [];
    } catch (error) {
      console.error("Error getting tasks via MCP:", error);
      return mockDataStore.getTasks();
    }
  }

  async getTaskLists() {
    if (!this.isConfigured) {
      return [{ id: '@default', title: 'My Tasks' }];
    }
    
    try {
      const result = await googleMCPServer['getTaskLists']({
        maxResults: 100
      });
      
      if (result.content && result.content[0]?.text) {
        return JSON.parse(result.content[0].text);
      }
      return [{ id: '@default', title: 'My Tasks' }];
    } catch (error) {
      console.error("Error getting task lists via MCP:", error);
      return [{ id: '@default', title: 'My Tasks' }];
    }
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
    
    try {
      const result = await googleMCPServer['createTask']({
        taskListId,
        title: taskData.title,
        notes: taskData.description,
        due: taskData.dueDate
      });
      
      if (result.content && result.content[0]?.text) {
        const task = JSON.parse(result.content[0].text);
        // Add priority field since Google Tasks doesn't have it natively
        return { ...task, priority: taskData.priority || 'medium' };
      }
      throw new Error('Invalid response from MCP server');
    } catch (error) {
      console.error("Error creating task via MCP:", error);
      throw error;
    }
  }

  async completeTask(taskListId: string, taskId: string) {
    if (!this.isConfigured) {
      throw new Error('MCP Server not configured');
    }
    
    try {
      const result = await googleMCPServer['completeTask']({
        taskListId,
        taskId
      });
      
      if (result.content && result.content[0]?.text) {
        return JSON.parse(result.content[0].text);
      }
      throw new Error('Invalid response from MCP server');
    } catch (error) {
      console.error("Error completing task via MCP:", error);
      throw error;
    }
  }

  // Auth URL methods (these remain the same)
  getCalendarAuthUrl(): string {
    return `/api/auth/google`;
  }

  getTasksAuthUrl(): string {
    return `/api/auth/google`;
  }

  async handleCalendarAuthCallback(code: string) {
    // OAuth is handled by the main auth system
    return { accessToken: '', refreshToken: '' };
  }

  async handleTasksAuthCallback(code: string) {
    // OAuth is handled by the main auth system
    return { accessToken: '', refreshToken: '' };
  }
}

// Export a singleton instance
export const mcpServerNew = new MCPServerNew();