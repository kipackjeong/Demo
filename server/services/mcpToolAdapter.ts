import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { mcpUnifiedServer } from "./mcpUnified.js";

/**
 * Create LangChain tools from MCP server capabilities
 * This adapter converts MCP tools into LangChain-compatible tools
 */
export class MCPToolAdapter {
  private tools: DynamicStructuredTool[] = [];
  private isInitialized: boolean = false;

  /**
   * Initialize tools based on MCP server configuration
   */
  async initialize(user?: any): Promise<void> {
    // Configure MCP server with user tokens if available
    if (user) {
      mcpUnifiedServer.configureWithUserTokens(user);
    }

    // Create LangChain tools from MCP capabilities
    this.tools = [
      new DynamicStructuredTool({
        name: "get_calendar_events",
        description: "Get calendar events from Google Calendar for a specific time range",
        schema: z.object({
          calendarId: z.string().default("primary").describe("Calendar ID to fetch events from"),
          timeMin: z.string().optional().describe("Start time in RFC3339 format"),
          timeMax: z.string().optional().describe("End time in RFC3339 format"),
        }),
        func: async ({ calendarId, timeMin, timeMax }) => {
          try {
            const events = await mcpUnifiedServer.getCalendarEventsDirectly(calendarId, timeMin, timeMax);
            return JSON.stringify(events, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to get calendar events: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: "create_calendar_event",
        description: "Create a new calendar event in Google Calendar",
        schema: z.object({
          title: z.string().describe("Event title"),
          description: z.string().optional().describe("Event description"),
          startDateTime: z.string().describe("Start time in RFC3339 format"),
          endDateTime: z.string().describe("End time in RFC3339 format"),
          location: z.string().optional().describe("Event location"),
          attendees: z.array(z.string()).optional().describe("List of attendee email addresses"),
          timeZone: z.string().default("UTC").describe("Timezone for the event"),
        }),
        func: async (params) => {
          try {
            const event = await mcpUnifiedServer.createCalendarEventDirectly("primary", params);
            return JSON.stringify(event, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to create calendar event: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: "list_calendars",
        description: "List all available Google Calendars",
        schema: z.object({}),
        func: async () => {
          try {
            const calendars = await mcpUnifiedServer.listCalendarsDirectly();
            return JSON.stringify(calendars, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to list calendars: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: "get_task_lists",
        description: "Get all task lists from Google Tasks",
        schema: z.object({}),
        func: async () => {
          try {
            const taskLists = await mcpUnifiedServer.getTaskListsDirectly();
            return JSON.stringify(taskLists, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to get task lists: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: "get_tasks",
        description: "Get tasks from Google Tasks. If no taskListId is provided, fetches from all task lists.",
        schema: z.object({
          taskListId: z.string().optional().describe("Task list ID to fetch tasks from. If not provided, fetches from all task lists."),
        }),
        func: async ({ taskListId }) => {
          try {
            const tasks = await mcpUnifiedServer.getTasksDirectly(taskListId);
            return JSON.stringify(tasks, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to get tasks: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: "create_task",
        description: "Create a new task in Google Tasks",
        schema: z.object({
          taskListId: z.string().describe("Task list ID to create task in"),
          title: z.string().describe("Task title"),
          notes: z.string().optional().describe("Task description/notes"),
          due: z.string().optional().describe("Due date in RFC3339 format"),
        }),
        func: async ({ taskListId, title, notes, due }) => {
          try {
            const task = await mcpUnifiedServer.createTaskDirectly(taskListId, { title, notes, due });
            return JSON.stringify(task, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to create task: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: "complete_task",
        description: "Mark a task as completed in Google Tasks",
        schema: z.object({
          taskListId: z.string().describe("Task list ID containing the task"),
          taskId: z.string().describe("Task ID to mark as completed"),
        }),
        func: async ({ taskListId, taskId }) => {
          try {
            const task = await mcpUnifiedServer.completeTaskDirectly(taskListId, taskId);
            return JSON.stringify(task, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to complete task: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: "delete_task",
        description: "Delete a task from Google Tasks",
        schema: z.object({
          taskListId: z.string().describe("Task list ID containing the task"),
          taskId: z.string().describe("Task ID to delete"),
        }),
        func: async ({ taskListId, taskId }) => {
          try {
            await mcpUnifiedServer.deleteTaskDirectly(taskListId, taskId);
            return JSON.stringify({ status: "task_deleted", taskId }, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to delete task: ${error.message}` });
          }
        },
      }),
    ];

    this.isInitialized = true;
  }

  /**
   * Get all available tools
   */
  getTools(): DynamicStructuredTool[] {
    if (!this.isInitialized) {
      throw new Error("MCPToolAdapter not initialized. Call initialize() first.");
    }
    return this.tools;
  }

  /**
   * Check if MCP server is ready
   */
  isReady(): boolean {
    return mcpUnifiedServer.isReady();
  }
}