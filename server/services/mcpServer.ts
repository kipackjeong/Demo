import { GoogleCalendarMCP } from './mcpGoogleCalendar';
import { GoogleTasksMCP } from './mcpGoogleTasks';

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
  private calendarMCP: GoogleCalendarMCP;
  private tasksMCP: GoogleTasksMCP;
  private isConfigured: boolean = false;

  constructor(config?: MCPServerConfig) {
    if (config) {
      this.calendarMCP = new GoogleCalendarMCP(config.googleCalendar);
      this.tasksMCP = new GoogleTasksMCP(config.googleTasks);
      this.isConfigured = true;
    }
  }

  configure(config: MCPServerConfig): void {
    this.calendarMCP = new GoogleCalendarMCP(config.googleCalendar);
    this.tasksMCP = new GoogleTasksMCP(config.googleTasks);
    this.isConfigured = true;
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