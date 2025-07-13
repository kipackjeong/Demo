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

    // Create comprehensive LangChain tools from MCP capabilities
    this.tools = [
      // Calendar Tools
      new DynamicStructuredTool({
        name: "get_calendar_events",
        description: "Get calendar events from Google Calendar for a specific time range. Use this when user asks for events in any time period.",
        schema: z.object({
          calendarId: z.string().default("primary").describe("Calendar ID to fetch events from"),
          timeMin: z.string().optional().describe("Start time in RFC3339 format (e.g., 2024-01-01T00:00:00Z)"),
          timeMax: z.string().optional().describe("End time in RFC3339 format (e.g., 2024-12-31T23:59:59Z)"),
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
        name: "get_today_events",
        description: "Get today's calendar events from Google Calendar",
        schema: z.object({
          calendarId: z.string().default("primary").describe("Calendar ID to fetch events from"),
        }),
        func: async ({ calendarId }) => {
          try {
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
            
            const events = await mcpUnifiedServer.getCalendarEventsDirectly(
              calendarId, 
              todayStart.toISOString(), 
              todayEnd.toISOString()
            );
            return JSON.stringify(events, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to get today's events: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: "get_this_week_events",
        description: "Get this week's calendar events from Google Calendar",
        schema: z.object({
          calendarId: z.string().default("primary").describe("Calendar ID to fetch events from"),
        }),
        func: async ({ calendarId }) => {
          try {
            const today = new Date();
            const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
            const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6));
            weekEnd.setHours(23, 59, 59);
            
            const events = await mcpUnifiedServer.getCalendarEventsDirectly(
              calendarId, 
              weekStart.toISOString(), 
              weekEnd.toISOString()
            );
            return JSON.stringify(events, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to get this week's events: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: "get_this_month_events",
        description: "Get this month's calendar events from Google Calendar",
        schema: z.object({
          calendarId: z.string().default("primary").describe("Calendar ID to fetch events from"),
        }),
        func: async ({ calendarId }) => {
          try {
            const today = new Date();
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
            
            const events = await mcpUnifiedServer.getCalendarEventsDirectly(
              calendarId, 
              monthStart.toISOString(), 
              monthEnd.toISOString()
            );
            return JSON.stringify(events, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to get this month's events: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: "get_this_year_events",
        description: "Get this year's calendar events from Google Calendar",
        schema: z.object({
          calendarId: z.string().default("primary").describe("Calendar ID to fetch events from"),
        }),
        func: async ({ calendarId }) => {
          try {
            const today = new Date();
            const yearStart = new Date(today.getFullYear(), 0, 1);
            const yearEnd = new Date(today.getFullYear(), 11, 31, 23, 59, 59);
            
            const events = await mcpUnifiedServer.getCalendarEventsDirectly(
              calendarId, 
              yearStart.toISOString(), 
              yearEnd.toISOString()
            );
            return JSON.stringify(events, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to get this year's events: ${error.message}` });
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

      // Task Tools
      new DynamicStructuredTool({
        name: "get_all_tasks",
        description: "Get all tasks from all Google Task lists. Use this when user asks for all tasks, tasks organized by list, or wants to see everything.",
        schema: z.object({}),
        func: async () => {
          try {
            const tasks = await mcpUnifiedServer.getTasksDirectly();
            return JSON.stringify(tasks, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to get all tasks: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: "get_tasks_from_list",
        description: "Get tasks from a specific Google Task list. Use this when user asks for tasks from a particular list.",
        schema: z.object({
          taskListId: z.string().describe("Task list ID to fetch tasks from"),
        }),
        func: async ({ taskListId }) => {
          try {
            const tasks = await mcpUnifiedServer.getTasksDirectly(taskListId);
            return JSON.stringify(tasks, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to get tasks from list: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: "get_high_priority_tasks",
        description: "Get high priority tasks from all Google Task lists. Use this when user asks for urgent or important tasks.",
        schema: z.object({}),
        func: async () => {
          try {
            const allTasks = await mcpUnifiedServer.getTasksDirectly();
            const highPriorityTasks = allTasks.filter((task: any) => task.priority === 'high');
            return JSON.stringify(highPriorityTasks, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to get high priority tasks: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: "get_overdue_tasks",
        description: "Get overdue tasks from all Google Task lists. Use this when user asks for overdue or past due tasks.",
        schema: z.object({}),
        func: async () => {
          try {
            const allTasks = await mcpUnifiedServer.getTasksDirectly();
            const now = new Date();
            const overdueTasks = allTasks.filter((task: any) => {
              if (!task.due) return false;
              const dueDate = new Date(task.due);
              return dueDate < now && task.status !== 'completed';
            });
            return JSON.stringify(overdueTasks, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to get overdue tasks: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: "get_tasks_due_today",
        description: "Get tasks due today from all Google Task lists.",
        schema: z.object({}),
        func: async () => {
          try {
            const allTasks = await mcpUnifiedServer.getTasksDirectly();
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
            
            const tasksDueToday = allTasks.filter((task: any) => {
              if (!task.due) return false;
              const dueDate = new Date(task.due);
              return dueDate >= todayStart && dueDate <= todayEnd && task.status !== 'completed';
            });
            return JSON.stringify(tasksDueToday, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to get tasks due today: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: "get_tasks_due_this_week",
        description: "Get tasks due this week from all Google Task lists.",
        schema: z.object({}),
        func: async () => {
          try {
            const allTasks = await mcpUnifiedServer.getTasksDirectly();
            const today = new Date();
            const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
            const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6));
            weekEnd.setHours(23, 59, 59);
            
            const tasksDueThisWeek = allTasks.filter((task: any) => {
              if (!task.due) return false;
              const dueDate = new Date(task.due);
              return dueDate >= weekStart && dueDate <= weekEnd && task.status !== 'completed';
            });
            return JSON.stringify(tasksDueThisWeek, null, 2);
          } catch (error) {
            return JSON.stringify({ error: `Failed to get tasks due this week: ${error.message}` });
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