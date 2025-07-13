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

interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accessToken?: string;
  refreshToken?: string;
}

export class GoogleMCPServer {
  private server: Server;
  private oauth2Client: OAuth2Client | null = null;
  private calendar: any = null;
  private tasks: any = null;
  private credentials: GoogleCredentials | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "google-services",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
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
            name: "Calendar Events",
            description: "Access to Google Calendar events",
            mimeType: "application/json",
          },
          {
            uri: "google://tasks/lists",
            name: "Task Lists",
            description: "Access to Google Tasks lists",
            mimeType: "application/json",
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.oauth2Client) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "Google services not configured. Please configure credentials first."
        );
      }

      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_calendar_events":
            return await this.getCalendarEvents(args);
          
          case "create_calendar_event":
            return await this.createCalendarEvent(args);
          
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

      if (!this.oauth2Client) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "Google services not configured"
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

  // Configure Google OAuth client
  configure(credentials: GoogleCredentials) {
    this.credentials = credentials;
    this.oauth2Client = new OAuth2Client(
      credentials.clientId,
      credentials.clientSecret,
      credentials.redirectUri
    );

    if (credentials.accessToken) {
      this.oauth2Client.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken,
      });

      // Initialize Google API clients
      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      this.tasks = google.tasks({ version: 'v1', auth: this.oauth2Client });
    }
  }

  // Calendar methods
  private async getCalendarEvents(args: any) {
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

  // Tasks methods
  private async getTaskLists(args: any) {
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

  // Start the server
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Google MCP Server started");
  }
}

// Export for use in the application
export const googleMCPServer = new GoogleMCPServer();