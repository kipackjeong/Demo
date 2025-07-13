import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { mockDataStore } from './mockDataStore.js';

interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accessToken?: string;
  refreshToken?: string;
}

interface MCPUnifiedConfig {
  credentials: GoogleCredentials;
  useMockData?: boolean;
}

export class MCPUnifiedServer {
  private server: Server;
  private oauth2Client: OAuth2Client | null = null;
  private calendar: any = null;
  private tasks: any = null;
  private isConfigured: boolean = false;
  private useMockData: boolean = false;
  private credentials: GoogleCredentials | null = null;

  constructor(config?: MCPUnifiedConfig) {
    this.server = new Server(
      {
        name: "google-services-unified",
        version: "2.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();

    if (config) {
      this.configure(config.credentials, config.useMockData);
    }
  }

  /**
   * Configure the MCP server with Google credentials
   */
  configure(credentials: GoogleCredentials, useMockData: boolean = false): void {
    this.credentials = credentials;
    this.useMockData = useMockData;

    // Only initialize OAuth if we have valid credentials and not using mock data
    if (!useMockData && credentials.clientId && credentials.clientSecret) {
      this.oauth2Client = new OAuth2Client(
        credentials.clientId,
        credentials.clientSecret,
        credentials.redirectUri
      );

      // Set tokens if available
      if (credentials.accessToken || credentials.refreshToken) {
        this.oauth2Client.setCredentials({
          access_token: credentials.accessToken,
          refresh_token: credentials.refreshToken,
        });

        // Initialize Google API clients
        this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
        this.tasks = google.tasks({ version: 'v1', auth: this.oauth2Client });
        this.isConfigured = true;

        console.log(`MCP Unified Server configured with Google credentials. Access Token: ${credentials.accessToken ? 'Present' : 'Missing'}, Refresh Token: ${credentials.refreshToken ? 'Present' : 'Missing'}`);
      }
    } else if (useMockData) {
      this.isConfigured = true;
      console.log('MCP Unified Server configured to use mock data');
    }
  }

  /**
   * Configure the server with user tokens from authentication
   */
  configureWithUserTokens(user: any): void {
    if (!user) {
      console.log('MCP Unified Server: No user provided, cannot configure');
      return;
    }

    const hasGoogleTokens = user.googleAccessToken || user.googleRefreshToken;
    
    if (hasGoogleTokens) {
      const credentials: GoogleCredentials = {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: '/api/auth/google/callback',
        accessToken: user.googleAccessToken,
        refreshToken: user.googleRefreshToken,
      };

      this.configure(credentials, false);
    } else {
      // Use mock data when user doesn't have Google tokens
      console.log('MCP Unified Server: User has no Google tokens, using mock data');
      this.configure({
        clientId: '',
        clientSecret: '',
        redirectUri: '',
      }, true);
    }
  }

  /**
   * Check if the server is ready to handle requests
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Setup request handlers for the MCP protocol
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "get_calendar_events",
            description: "Get calendar events from Google Calendar",
            inputSchema: {
              type: "object",
              properties: {
                calendarId: { type: "string", default: "primary" },
                timeMin: { type: "string", description: "RFC3339 timestamp" },
                timeMax: { type: "string", description: "RFC3339 timestamp" },
                maxResults: { type: "number", default: 100 }
              },
            },
          },
          {
            name: "create_calendar_event",
            description: "Create a new calendar event",
            inputSchema: {
              type: "object",
              properties: {
                calendarId: { type: "string", default: "primary" },
                title: { type: "string", required: true },
                description: { type: "string" },
                startDateTime: { type: "string", required: true },
                endDateTime: { type: "string", required: true },
                location: { type: "string" },
                attendees: { type: "array", items: { type: "string" } },
                timeZone: { type: "string", default: "UTC" }
              },
              required: ["title", "startDateTime", "endDateTime"],
            },
          },
          {
            name: "list_calendars",
            description: "List all available calendars",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "get_task_lists",
            description: "Get all task lists from Google Tasks",
            inputSchema: {
              type: "object",
              properties: {
                maxResults: { type: "number", default: 100 }
              },
            },
          },
          {
            name: "get_tasks",
            description: "Get tasks from a specific task list",
            inputSchema: {
              type: "object",
              properties: {
                taskListId: { type: "string", default: "@default" },
                showCompleted: { type: "boolean", default: false },
                maxResults: { type: "number", default: 100 }
              },
            },
          },
          {
            name: "create_task",
            description: "Create a new task",
            inputSchema: {
              type: "object",
              properties: {
                taskListId: { type: "string", required: true },
                title: { type: "string", required: true },
                notes: { type: "string" },
                due: { type: "string", description: "RFC3339 timestamp" },
              },
              required: ["taskListId", "title"],
            },
          },
          {
            name: "complete_task",
            description: "Mark a task as completed",
            inputSchema: {
              type: "object",
              properties: {
                taskListId: { type: "string", required: true },
                taskId: { type: "string", required: true },
              },
              required: ["taskListId", "taskId"],
            },
          },
        ],
      };
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "google://calendar/events",
            name: "Google Calendar Events",
            description: "List of calendar events",
            mimeType: "application/json",
          },
          {
            uri: "google://tasks/lists",
            name: "Google Task Lists",
            description: "List of task lists",
            mimeType: "application/json",
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!this.isConfigured) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "MCP server not configured. Please authenticate first."
        );
      }

      try {
        switch (name) {
          case "get_calendar_events":
            return await this.getCalendarEvents(args);
          
          case "create_calendar_event":
            return await this.createCalendarEvent(args);
          
          case "list_calendars":
            return await this.listCalendars(args);
          
          case "get_task_lists":
            return await this.getTaskLists(args);
          
          case "get_tasks":
            return await this.getTasks(args);
          
          case "create_task":
            return await this.createTask(args);
          
          case "complete_task":
            return await this.completeTask(args);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Tool ${name} not found`
            );
        }
      } catch (error: any) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error.message}`
        );
      }
    });

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (!this.isConfigured) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "MCP server not configured"
        );
      }

      try {
        if (uri === "google://calendar/events") {
          const events = await this.getCalendarEvents({ calendarId: "primary" });
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(events.content, null, 2),
              },
            ],
          };
        } else if (uri === "google://tasks/lists") {
          const lists = await this.getTaskLists({});
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(lists.content, null, 2),
              },
            ],
          };
        } else {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Resource ${uri} not found`
          );
        }
      } catch (error: any) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error reading resource: ${error.message}`
        );
      }
    });
  }

  // Calendar operations
  private async getCalendarEvents(args: any) {
    if (this.useMockData) {
      const events = mockDataStore.getCalendarEvents();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(events, null, 2),
          },
        ],
      };
    }

    if (!this.calendar) {
      throw new Error("Calendar service not initialized");
    }

    const response = await this.calendar.events.list({
      calendarId: args.calendarId || 'primary',
      timeMin: args.timeMin || new Date().toISOString(),
      timeMax: args.timeMax,
      maxResults: args.maxResults || 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(events.map(this.formatCalendarEvent), null, 2),
        },
      ],
    };
  }

  private async createCalendarEvent(args: any) {
    if (this.useMockData) {
      const event = mockDataStore.addCalendarEvent({
        title: args.title,
        description: args.description || '',
        date: args.startDateTime.split('T')[0],
        time: '12:00 PM', // Mock time
        endTime: '1:00 PM', // Mock end time
        location: args.location || '',
        attendees: args.attendees || [],
        status: 'confirmed',
        priority: 'medium',
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(event, null, 2),
          },
        ],
      };
    }

    if (!this.calendar) {
      throw new Error("Calendar service not initialized");
    }

    const event = {
      summary: args.title,
      description: args.description,
      location: args.location,
      start: {
        dateTime: args.startDateTime,
        timeZone: args.timeZone || 'UTC',
      },
      end: {
        dateTime: args.endDateTime,
        timeZone: args.timeZone || 'UTC',
      },
      attendees: args.attendees?.map((email: string) => ({ email })),
    };

    const response = await this.calendar.events.insert({
      calendarId: args.calendarId || 'primary',
      requestBody: event,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(this.formatCalendarEvent(response.data), null, 2),
        },
      ],
    };
  }

  private async listCalendars(args: any) {
    if (this.useMockData) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify([{ id: 'primary', summary: 'Primary Calendar' }], null, 2),
          },
        ],
      };
    }

    if (!this.calendar) {
      throw new Error("Calendar service not initialized");
    }

    const response = await this.calendar.calendarList.list();
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response.data.items || [], null, 2),
        },
      ],
    };
  }

  // Task operations
  private async getTaskLists(args: any) {
    if (this.useMockData) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify([{ id: '@default', title: 'My Tasks' }], null, 2),
          },
        ],
      };
    }

    if (!this.tasks) {
      throw new Error("Tasks service not initialized");
    }

    const response = await this.tasks.tasklists.list({
      maxResults: args.maxResults || 100,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response.data.items || [], null, 2),
        },
      ],
    };
  }

  private async getTasks(args: any) {
    if (this.useMockData) {
      const tasks = mockDataStore.getTasks()
        .filter(task => args.showCompleted || !task.completed);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tasks, null, 2),
          },
        ],
      };
    }

    if (!this.tasks) {
      throw new Error("Tasks service not initialized");
    }

    const response = await this.tasks.tasks.list({
      tasklist: args.taskListId || '@default',
      maxResults: args.maxResults || 100,
      showCompleted: args.showCompleted || false,
    });

    const tasks = response.data.items || [];
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(tasks.map(this.formatTask), null, 2),
        },
      ],
    };
  }

  private async createTask(args: any) {
    if (this.useMockData) {
      const task = mockDataStore.addTask({
        title: args.title,
        description: args.notes || '',
        priority: 'medium',
        dueDate: args.due ? args.due.split('T')[0] : new Date().toISOString().split('T')[0],
        completed: false,
        category: 'general',
        estimatedTime: '1 hour',
        tags: [],
        createdDate: new Date().toISOString().split('T')[0],
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(task, null, 2),
          },
        ],
      };
    }

    if (!this.tasks) {
      throw new Error("Tasks service not initialized");
    }

    const task = {
      title: args.title,
      notes: args.notes,
      due: args.due,
    };

    const response = await this.tasks.tasks.insert({
      tasklist: args.taskListId,
      requestBody: task,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(this.formatTask(response.data), null, 2),
        },
      ],
    };
  }

  private async completeTask(args: any) {
    if (this.useMockData) {
      const task = mockDataStore.completeTask(args.taskId);
      if (!task) {
        throw new Error("Task not found");
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(task, null, 2),
          },
        ],
      };
    }

    if (!this.tasks) {
      throw new Error("Tasks service not initialized");
    }

    // First get the task
    const task = await this.tasks.tasks.get({
      tasklist: args.taskListId,
      task: args.taskId,
    });

    // Update status to completed
    const response = await this.tasks.tasks.update({
      tasklist: args.taskListId,
      task: args.taskId,
      requestBody: {
        ...task.data,
        status: 'completed',
        completed: new Date().toISOString(),
      },
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(this.formatTask(response.data), null, 2),
        },
      ],
    };
  }

  private async deleteTask(args: any) {
    if (this.useMockData) {
      const success = mockDataStore.deleteTask(args.taskId);
      if (!success) {
        throw new Error("Task not found");
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: "task_deleted", taskId: args.taskId }, null, 2),
          },
        ],
      };
    }

    if (!this.tasks) {
      throw new Error("Tasks service not initialized");
    }

    await this.tasks.tasks.delete({
      tasklist: args.taskListId,
      task: args.taskId,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ status: "task_deleted", taskId: args.taskId }, null, 2),
        },
      ],
    };
  }

  // Formatting helpers
  private formatCalendarEvent(event: any) {
    return {
      id: event.id,
      title: event.summary || "No title",
      description: event.description || "",
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location || "",
      attendees: event.attendees?.map((a: any) => a.email) || [],
      status: event.status,
    };
  }

  private formatTask(task: any) {
    return {
      id: task.id,
      title: task.title,
      notes: task.notes || "",
      due: task.due,
      completed: task.completed || null,
      status: task.status,
      position: task.position,
    };
  }

  // Start the server for standalone mode
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("MCP Unified Server started");
  }

  // Direct method calls for embedded mode (used by agents)
  async getCalendarEventsDirectly(calendarId?: string, timeMin?: string, timeMax?: string) {
    const result = await this.getCalendarEvents({
      calendarId: calendarId || 'primary',
      timeMin,
      timeMax,
    });
    return JSON.parse(result.content[0].text);
  }

  async createCalendarEventDirectly(calendarId: string | undefined, eventData: any) {
    const result = await this.createCalendarEvent({
      calendarId: calendarId || 'primary',
      ...eventData,
    });
    return JSON.parse(result.content[0].text);
  }

  async listCalendarsDirectly() {
    const result = await this.listCalendars({});
    return JSON.parse(result.content[0].text);
  }

  async getTasksDirectly(taskListId?: string) {
    const result = await this.getTasks({
      taskListId: taskListId || '@default',
      showCompleted: true,
    });
    return JSON.parse(result.content[0].text);
  }

  async getTaskListsDirectly() {
    const result = await this.getTaskLists({});
    return JSON.parse(result.content[0].text);
  }

  async createTaskDirectly(taskListId: string, taskData: any) {
    const result = await this.createTask({
      taskListId,
      ...taskData,
    });
    return JSON.parse(result.content[0].text);
  }

  async completeTaskDirectly(taskListId: string, taskId: string) {
    const result = await this.completeTask({
      taskListId,
      taskId,
    });
    return JSON.parse(result.content[0].text);
  }

  async deleteTaskDirectly(taskListId: string, taskId: string) {
    const result = await this.deleteTask({
      taskListId,
      taskId,
    });
    return JSON.parse(result.content[0].text);
  }

  // Auth URL generation helpers
  getCalendarAuthUrl(): string {
    if (!this.oauth2Client) {
      this.oauth2Client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        '/api/auth/google/callback'
      );
    }

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/tasks',
      ],
      prompt: 'consent',
    });
  }

  async handleAuthCallback(code: string) {
    if (!this.oauth2Client) {
      throw new Error('OAuth client not initialized');
    }

    const { tokens } = await this.oauth2Client.getToken(code);
    return {
      accessToken: tokens.access_token || '',
      refreshToken: tokens.refresh_token || '',
    };
  }
}

// Export singleton instance
export const mcpUnifiedServer = new MCPUnifiedServer();