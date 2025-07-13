import { StateGraph, END, START } from "@langchain/langgraph";
import { AzureChatOpenAI } from "@langchain/azure-openai";
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { BaseMessage } from "@langchain/core/messages";
import { MCPToolAdapter } from "./mcpToolAdapter.js";
import { ToolNode } from "@langchain/langgraph/prebuilt";

// Define the state interface for the life management system
interface LifeManagerState {
  messages: BaseMessage[];
  userMessage: string;
  sessionId: string;
  finalResponse?: string;
  isInitialSummary?: boolean;
}

export class LifeManagerSystemRefactored {
  private azureOpenAI: AzureChatOpenAI | null = null;
  private conversationHistory: Map<string, Array<{ role: string; content: string }>> = new Map();
  private graph: StateGraph<LifeManagerState> | null = null;
  private mcpToolAdapter: MCPToolAdapter;
  private tools: any[] = [];

  constructor(user?: any) {
    this.mcpToolAdapter = new MCPToolAdapter();
    this.initializeAzureOpenAI();
    this.initializeTools(user);
  }

  private initializeAzureOpenAI() {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME?.trim();
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-01";

    if (!endpoint || !deploymentName || !apiKey) {
      console.log("Azure OpenAI configuration incomplete");
      return;
    }

    try {
      this.azureOpenAI = new AzureChatOpenAI({
        azureOpenAIApiKey: apiKey,
        azureOpenAIEndpoint: endpoint,
        azureOpenAIApiDeploymentName: deploymentName,
        azureOpenAIApiVersion: apiVersion,
        temperature: 0.7,
        maxTokens: 2000,
      });
      console.log("Life Manager system: Azure OpenAI initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Azure OpenAI:", error);
    }
  }

  private async initializeTools(user?: any) {
    try {
      await this.mcpToolAdapter.initialize(user);
      this.tools = this.mcpToolAdapter.getTools();
      this.setupLifeManagerGraph();
      console.log("Life Manager system: Tools initialized successfully");
    } catch (error) {
      console.error("Failed to initialize tools:", error);
    }
  }

  private setupLifeManagerGraph() {
    if (!this.azureOpenAI) {
      console.error("Cannot setup graph without Azure OpenAI");
      return;
    }

    // Create the graph
    const workflow = new StateGraph<LifeManagerState>({
      channels: {
        messages: {
          value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
          default: () => [],
        },
        userMessage: null,
        sessionId: null,
        finalResponse: null,
        isInitialSummary: null,
      },
    });

    // Add the agent node that calls the model with tools
    workflow.addNode("agent", async (state: LifeManagerState) => {
      const systemPrompt = this.getSystemPrompt(state.isInitialSummary || false);
      
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(state.userMessage)
      ];

      // Bind tools to the model
      const modelWithTools = this.azureOpenAI!.bindTools(this.tools);
      
      try {
        const response = await modelWithTools.invoke(messages);
        return { messages: [response] };
      } catch (error) {
        console.error("Error invoking model:", error);
        const errorMessage = new AIMessage("I encountered an error processing your request. Please try again.");
        return { messages: [errorMessage] };
      }
    });

    // Add the tool node
    const toolNode = new ToolNode(this.tools);
    workflow.addNode("tools", toolNode);

    // Add the response formatter node
    workflow.addNode("formatter", async (state: LifeManagerState) => {
      const lastMessage = state.messages[state.messages.length - 1];
      
      // Extract the final response from the conversation
      let finalResponse = "";
      
      if (lastMessage instanceof AIMessage) {
        finalResponse = lastMessage.content as string;
      }

      // For initial summaries, ensure proper formatting
      if (state.isInitialSummary && finalResponse) {
        finalResponse = this.formatInitialSummary(finalResponse, state.messages);
      }

      return { finalResponse };
    });

    // Define the conditional edge function
    function shouldContinue(state: LifeManagerState): string {
      const lastMessage = state.messages[state.messages.length - 1];
      
      // If the last message has tool calls, route to tools
      if (lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        return "tools";
      }
      
      // Otherwise, we're done
      return "formatter";
    }

    // Set up the edges
    workflow.addEdge(START, "agent");
    workflow.addConditionalEdges("agent", shouldContinue);
    workflow.addEdge("tools", "agent");
    workflow.addEdge("formatter", END);

    // Compile the graph
    this.graph = workflow.compile();
    console.log("Life Manager system: Graph compiled successfully");
  }

  private getSystemPrompt(isInitialSummary: boolean): string {
    if (isInitialSummary) {
      return `You are a helpful life management assistant with access to the user's Google Calendar and Tasks.

For the INITIAL SUMMARY request, you MUST:
1. Use the get_calendar_events tool to fetch upcoming calendar events
2. Use the get_tasks tool to fetch current tasks
3. Create a well-formatted weekly summary in this EXACT structure:

## 📅 This Week's Calendar

[List each calendar event with proper formatting]
- **Event Title** - Day, Date, Time
  Location: [location if available]
  [Brief description if available]

## ✅ Tasks

### High Priority
[List high priority tasks]
- Task title (Due: date)

### Medium Priority
[List medium priority tasks]
- Task title (Due: date)

### Low Priority
[List low priority tasks]
- Task title (Due: date)

## 💡 Recommendations
[2-3 actionable recommendations based on the calendar and tasks]

IMPORTANT RULES:
- Use ONLY English throughout the response
- Format dates as "Monday, July 15" (not just dates)
- Include ALL events and tasks from the data
- Keep descriptions concise but informative
- Use proper markdown formatting`;
    }

    return `You are a helpful life management assistant with access to the user's Google Calendar and Tasks.

You have access to the following tools:
- get_calendar_events: Fetch calendar events
- create_calendar_event: Create new calendar events
- list_calendars: List available calendars
- get_tasks: Fetch tasks
- get_task_lists: Get task lists
- create_task: Create new tasks
- complete_task: Mark tasks as completed

When the user asks to:
- Schedule/add/create events → Use create_calendar_event
- View calendar/events → Use get_calendar_events
- Add/create tasks → Use create_task
- View tasks → Use get_tasks
- Complete/finish tasks → Use complete_task

IMPORTANT RULES:
- Always use tools to interact with calendar and tasks
- Use ONLY English in your responses
- Be helpful and conversational
- Provide clear confirmations after actions`;
  }

  private formatInitialSummary(response: string, messages: BaseMessage[]): string {
    // Extract tool results from messages
    let calendarData: any[] = [];
    let tasksData: any[] = [];

    for (const message of messages) {
      if (message instanceof ToolMessage) {
        try {
          const result = JSON.parse(message.content as string);
          
          // Check if this is calendar data
          if (Array.isArray(result) && result.length > 0 && result[0].hasOwnProperty('start')) {
            calendarData = result;
          }
          // Check if this is task data
          else if (Array.isArray(result) && result.length > 0 && result[0].hasOwnProperty('notes')) {
            tasksData = result;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }

    // If we have raw data, format it properly
    if (calendarData.length > 0 || tasksData.length > 0) {
      let formattedResponse = "## 📅 This Week's Calendar\n\n";

      // Format calendar events
      if (calendarData.length > 0) {
        const sortedEvents = calendarData.sort((a, b) => 
          new Date(a.start).getTime() - new Date(b.start).getTime()
        );

        for (const event of sortedEvents) {
          const startDate = new Date(event.start);
          const dateStr = startDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          });
          const timeStr = startDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });

          formattedResponse += `- **${event.title || 'Untitled Event'}** - ${dateStr}, ${timeStr}\n`;
          if (event.location) {
            formattedResponse += `  Location: ${event.location}\n`;
          }
          if (event.description) {
            formattedResponse += `  ${event.description}\n`;
          }
          formattedResponse += "\n";
        }
      } else {
        formattedResponse += "No upcoming events scheduled.\n";
      }

      formattedResponse += "\n## ✅ Tasks\n\n";

      // Format tasks by priority
      if (tasksData.length > 0) {
        const highPriority = tasksData.filter(t => t.priority === 'high' && !t.completed);
        const mediumPriority = tasksData.filter(t => t.priority === 'medium' && !t.completed);
        const lowPriority = tasksData.filter(t => t.priority === 'low' && !t.completed);

        if (highPriority.length > 0) {
          formattedResponse += "### High Priority\n";
          for (const task of highPriority) {
            formattedResponse += `- ${task.title}`;
            if (task.due) {
              const dueDate = new Date(task.due);
              formattedResponse += ` (Due: ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
            }
            formattedResponse += "\n";
          }
          formattedResponse += "\n";
        }

        if (mediumPriority.length > 0) {
          formattedResponse += "### Medium Priority\n";
          for (const task of mediumPriority) {
            formattedResponse += `- ${task.title}`;
            if (task.due) {
              const dueDate = new Date(task.due);
              formattedResponse += ` (Due: ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
            }
            formattedResponse += "\n";
          }
          formattedResponse += "\n";
        }

        if (lowPriority.length > 0) {
          formattedResponse += "### Low Priority\n";
          for (const task of lowPriority) {
            formattedResponse += `- ${task.title}`;
            if (task.due) {
              const dueDate = new Date(task.due);
              formattedResponse += ` (Due: ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
            }
            formattedResponse += "\n";
          }
          formattedResponse += "\n";
        }
      } else {
        formattedResponse += "No active tasks.\n";
      }

      formattedResponse += "\n## 💡 Recommendations\n\n";
      formattedResponse += "1. Review your upcoming events and prepare any necessary materials\n";
      formattedResponse += "2. Focus on completing high-priority tasks first\n";
      formattedResponse += "3. Consider scheduling time for any overdue tasks\n";

      return formattedResponse;
    }

    // Return the original response if we couldn't format it
    return response;
  }

  async process(userMessage: string, sessionId: string): Promise<string> {
    if (!this.graph) {
      return "I'm having trouble with my configuration. Please try again later.";
    }

    try {
      // Check if this is an initial summary request
      const isInitialSummary = userMessage.includes("[INITIAL_SUMMARY]");
      const cleanMessage = userMessage.replace("[INITIAL_SUMMARY]", "").trim();

      const input: LifeManagerState = {
        messages: [],
        userMessage: cleanMessage,
        sessionId,
        isInitialSummary,
      };

      const result = await this.graph.invoke(input);
      
      return result.finalResponse || "I couldn't process your request. Please try again.";
    } catch (error) {
      console.error("Error processing message:", error);
      return "I encountered an error while processing your request. Please try again.";
    }
  }

  getSystemStatus(): Record<string, any> {
    return {
      azureOpenAI: this.azureOpenAI ? "configured" : "not configured",
      graph: this.graph ? "compiled" : "not compiled",
      mcpServer: this.mcpToolAdapter.isReady() ? "ready" : "not ready",
      toolsCount: this.tools.length,
    };
  }
}