import { StateGraph, END, START } from "@langchain/langgraph";
import { AzureChatOpenAI } from "@langchain/azure-openai";
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
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
  private conversationHistory: Map<
    string,
    Array<{ role: string; content: string }>
  > = new Map();
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
      const systemPrompt = this.getSystemPrompt(
        state.isInitialSummary || false,
      );

      // Build messages array with conversation history
      const messages = [
        new SystemMessage(systemPrompt),
        ...state.messages, // Previous conversation history
        new HumanMessage(state.userMessage), // Current user message
      ];

      console.log("\n=== AGENT NODE EXECUTION ===");
      console.log("Agent node executing with", this.tools.length, "tools");
      console.log("Current state messages:", state.messages.length);
      console.log(
        "Message types:",
        state.messages.map((m) => m.constructor.name),
      );
      console.log("User message:", state.userMessage);

      // If we just executed tools, we need to format the response
      const hasToolMessages = state.messages.some(
        (m) => m.constructor.name === "ToolMessage",
      );
      
      if (hasToolMessages && !state.isInitialSummary) {
        // We've already executed tools, just format a response
        console.log("Tool execution complete, formatting response");
        
        // Get the last tool message
        const toolMessages = state.messages.filter(m => m.constructor.name === "ToolMessage");
        const lastToolMessage = toolMessages[toolMessages.length - 1];
        
        let finalResponse = "";
        if (lastToolMessage) {
          try {
            const toolResult = JSON.parse(lastToolMessage.content as string);
            if (toolResult.status === "task_created" && toolResult.task) {
              const task = toolResult.task;
              finalResponse = `I've created a task "${task.title}" to remind you about this. `;
              if (task.priority === "high") {
                finalResponse += "It's marked as high priority. ";
              }
              finalResponse += "The task has been added to your default task list.";
            } else {
              finalResponse = "I've completed the requested action.";
            }
          } catch (e) {
            // If parsing fails, use generic response
            finalResponse = "I've created the task for you. It's been added to your default task list.";
          }
        } else {
          finalResponse = "I've completed the requested action.";
        }
        
        return { messages: [new AIMessage(finalResponse)] };
      }

      try {
        // Always provide tools to the model and let it decide intelligently
        console.log("Invoking model with all available tools...");
        
        // Add timeout for Azure OpenAI call
        const azureTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Azure OpenAI timeout")), 30000),
        );
        
        const response = await Promise.race([
          this.azureOpenAI!.invoke(messages, {
            tools: this.tools.map(tool => ({
              type: "function" as const,
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.schema,
              },
            })),
            timeout: 30000, // 30 second timeout
            maxRetries: 2, // Reduce retries for faster failure
          }),
          azureTimeout
        ]);
        
        console.log("AGENT RESPONSE:", response.content?.toString());
        
        if (response.tool_calls && response.tool_calls.length > 0) {
          console.log(`Model decided to use ${response.tool_calls.length} tools:`, 
            response.tool_calls.map(tc => tc.function.name).join(', '));
        } else {
          console.log("Model decided not to use any tools for this response");
        }
        
        return { messages: [response] };
      } catch (error) {
        console.error("Error invoking model:", error);
        
        // For regular chat, fall back to a simple response without tools
        if (!state.isInitialSummary) {
          console.log("Falling back to simple response without tools");
          try {
            // Try one more time without tools
            const simpleResponse = await this.azureOpenAI!.invoke(messages, {
              timeout: 15000,
              maxRetries: 1,
            });
            return { messages: [simpleResponse] };
          } catch (fallbackError) {
            console.error("Fallback also failed:", fallbackError);
          }
        }
        
        const errorMessage = new AIMessage(
          "I encountered an error processing your request. Please try again.",
        );
        return { messages: [errorMessage] };
      }
    });

    // Add the tool node with manual tool execution
    workflow.addNode("tools", async (state: LifeManagerState) => {
      console.log("\n=== TOOLS NODE EXECUTION ===");
      const lastMessage = state.messages[state.messages.length - 1];

      if (!(lastMessage instanceof AIMessage) || !lastMessage.tool_calls) {
        console.log("No tool calls found in last message");
        return { messages: [] };
      }

      console.log(
        "Tool calls to execute:",
        lastMessage.tool_calls.map((tc) => tc.function.name),
      );

      const toolMessages: ToolMessage[] = [];

      // Manually execute each tool call
      for (const toolCall of lastMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`Executing tool: ${toolName} with args:`, toolArgs);
        
        // Find the tool by name
        const tool = this.tools.find(t => t.name === toolName);
        
        if (!tool) {
          console.error(`Tool ${toolName} not found in available tools`);
          toolMessages.push(
            new ToolMessage({
              content: JSON.stringify({ error: `Tool ${toolName} not found` }),
              tool_call_id: toolCall.id,
            })
          );
          continue;
        }
        
        try {
          // Execute the tool
          const result = await tool.func(toolArgs);
          console.log(`Tool ${toolName} executed successfully`);
          
          toolMessages.push(
            new ToolMessage({
              content: result,
              tool_call_id: toolCall.id,
            })
          );
        } catch (error) {
          console.error(`Error executing tool ${toolName}:`, error);
          toolMessages.push(
            new ToolMessage({
              content: JSON.stringify({ error: error.message }),
              tool_call_id: toolCall.id,
            })
          );
        }
      }

      console.log(`Tools executed. ${toolMessages.length} tool responses generated`);
      return { messages: toolMessages };
    });

    // Add the response formatter node
    workflow.addNode("formatter", async (state: LifeManagerState) => {
      console.log("\n=== FORMATTER NODE EXECUTION ===");
      console.log("Total messages in state:", state.messages.length);

      const lastMessage = state.messages[state.messages.length - 1];

      // Extract the final response from the conversation
      let finalResponse = "";

      console.log("Last message constructor name:", lastMessage?.constructor.name);
      console.log("Last message content:", lastMessage?.content);

      // Check if it's an AI message by checking constructor name or if it has content property
      if (lastMessage && (lastMessage.constructor.name === "AIMessage" || lastMessage.content)) {
        finalResponse = lastMessage.content as string;
        console.log(
          "FINAL AGENT RESPONSE:",
          finalResponse ? finalResponse.substring(0, 200) + "..." : "EMPTY RESPONSE",
        );
      } else {
        console.log("Unable to extract response from last message");
      }

      // Check if we should format the response based on tool messages
      const hasCalendarOrTaskTools = state.messages.some((m) => {
        if (m.constructor.name === "ToolMessage") {
          try {
            const result = JSON.parse(m.content as string);
            return Array.isArray(result);
          } catch (e) {
            return false;
          }
        }
        return false;
      });

      // For initial summaries or when we have calendar/task data, ensure proper formatting
      if ((state.isInitialSummary || hasCalendarOrTaskTools) && finalResponse) {
        console.log("Applying schedule formatting...");
        finalResponse = this.formatScheduleResponse(
          finalResponse,
          state.messages,
          state.isInitialSummary
        );
      }

      console.log("Formatter complete. Response length:", finalResponse.length);
      return { finalResponse };
    });

    // Define the conditional edge function
    function shouldContinue(state: LifeManagerState): string {
      const lastMessage = state.messages[state.messages.length - 1];

      console.log("\n=== ROUTING DECISION ===");
      console.log("Last message type:", lastMessage?.constructor.name);
      console.log("Total messages:", state.messages.length);

      // Count how many times we've been through the agent node
      const aiMessageCount = state.messages.filter(m => m instanceof AIMessage).length;
      console.log("AI message count:", aiMessageCount);

      // If we've already processed tools and generated a response, go to formatter
      if (aiMessageCount >= 2 && state.messages.some(m => m instanceof ToolMessage)) {
        console.log("Decision: Route to FORMATTER - already processed tools");
        return "formatter";
      }

      // If the last message has tool calls, route to tools
      if (
        lastMessage instanceof AIMessage &&
        lastMessage.tool_calls &&
        lastMessage.tool_calls.length > 0
      ) {
        console.log(
          "Decision: Route to TOOLS - found",
          lastMessage.tool_calls.length,
          "tool calls",
        );
        return "tools";
      }

      // Otherwise, we're done
      console.log("Decision: Route to FORMATTER - no more tool calls");
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
1. Use the get_calendar_events tool to fetch calendar events for the next 3 days
2. Use the get_tasks tool to fetch current tasks
3. Create a well-formatted summary in this EXACT structure:

## 📅 Next 3 Days

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

    return `You are an intelligent life management assistant with access to the user's Google Calendar and Tasks.

You have access to these tools:
- get_calendar_events: Fetch calendar events for any time range
- create_calendar_event: Create new calendar events
- list_calendars: List available calendars
- get_tasks: Fetch tasks from task lists
- get_task_lists: Get available task lists
- create_task: Create new tasks
- complete_task: Mark tasks as completed

Tool Usage Guidelines:
1. Analyze the user's request and determine the appropriate action
2. Use multiple tools if needed (e.g., fetch both calendar and tasks for schedule overview)
3. For questions about schedule/agenda → Use get_calendar_events AND get_tasks
4. For creating reminders/todos → Use create_task
5. For scheduling meetings/appointments → Use create_calendar_event
6. Always confirm successful actions with specific details

Response Guidelines:
- For schedule queries: Format events and tasks in a clear, organized manner
- For action requests: Execute the action and confirm with details
- For conversations: Be helpful and natural, use tools when relevant
- Use markdown formatting for better readability when showing lists

IMPORTANT:
- Think step by step about what the user needs
- Use tools proactively to fulfill requests
- Don't make assumptions - use the data from tools
- Keep responses concise but informative`;
  }

  private formatScheduleResponse(
    response: string,
    messages: BaseMessage[],
    isInitialSummary: boolean = false
  ): string {
    // If response already contains proper formatting markers, return it as-is
    if (response.includes("## 📅") && response.includes("## ✅") && response.includes("## 💡")) {
      console.log("Response already properly formatted, returning as-is");
      return response;
    }

    // Extract tool results from messages
    let calendarData: any[] = [];
    let tasksData: any[] = [];

    for (const message of messages) {
      if (message instanceof ToolMessage) {
        try {
          const result = JSON.parse(message.content as string);

          // Check if this is calendar data
          if (Array.isArray(result)) {
            // Check if empty array or has calendar-like properties
            if (result.length === 0 || (result[0] && (result[0].start || result[0].startTime))) {
              calendarData = result;
            }
            // Otherwise assume it's tasks data
            else if (result[0] && (result[0].title || result[0].notes !== undefined)) {
              tasksData = result;
            }
          }
        } catch (e) {
          console.error("Error parsing tool message:", e);
        }
      }
    }

    console.log(`Formatting with ${calendarData.length} events and ${tasksData.length} tasks`);

    // Format the response properly
    let formattedResponse = isInitialSummary ? "## 📅 Next 3 Days\n\n" : "## 📅 This Week's Schedule\n\n";

    // Format calendar events
    if (calendarData.length > 0) {
      const sortedEvents = calendarData.sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
      );

      for (const event of sortedEvents) {
        const startDate = new Date(event.start);
        const dateStr = startDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        });
        const timeStr = startDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

        formattedResponse += `- **${event.title || "Untitled Event"}** - ${dateStr}, ${timeStr}\n`;
        if (event.location) {
          formattedResponse += `  Location: ${event.location}\n`;
        }
        if (event.description) {
          formattedResponse += `  ${event.description}\n`;
        }
        formattedResponse += "\n";
      }
    } else {
      formattedResponse += isInitialSummary ? "No events scheduled for the next 3 days.\n" : "No events scheduled this week.\n";
    }

    formattedResponse += "\n## ✅ Tasks\n\n";

    // Format tasks - Google Tasks don't have priority field
    if (tasksData.length > 0) {
      for (const task of tasksData) {
        if (task.status !== "completed") {
          formattedResponse += `- ${task.title}`;
          if (task.due) {
            const dueDate = new Date(task.due);
            formattedResponse += ` (Due: ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;
          }
          formattedResponse += "\n";
        }
      }
    } else {
      formattedResponse += "No active tasks.\n";
    }

    formattedResponse += "\n## 💡 Recommendations\n\n";
    formattedResponse +=
      "1. Review your upcoming events and prepare any necessary materials\n";
    formattedResponse += "2. Focus on completing high-priority tasks first\n";
    formattedResponse +=
      "3. Consider scheduling time for any overdue tasks\n";

    return formattedResponse;
  }

  async process(userMessage: string, sessionId: string): Promise<string> {
    if (!this.graph) {
      return "I'm having trouble with my configuration. Please try again later.";
    }

    try {
      // Check if this is an initial summary request
      const isInitialSummary = userMessage.includes("[INITIAL_SUMMARY]");
      const cleanMessage = userMessage.replace("[INITIAL_SUMMARY]", "").trim();

      // Get conversation history for this session
      const sessionHistory = this.conversationHistory.get(sessionId) || [];
      
      // Convert conversation history to BaseMessage format
      const historyMessages: BaseMessage[] = [];
      for (const msg of sessionHistory) {
        if (msg.role === 'user') {
          historyMessages.push(new HumanMessage(msg.content));
        } else if (msg.role === 'assistant') {
          historyMessages.push(new AIMessage(msg.content));
        }
      }

      const input: LifeManagerState = {
        messages: historyMessages,
        userMessage: cleanMessage,
        sessionId,
        isInitialSummary,
      };

      console.log("Processing request with graph:", {
        isInitialSummary,
        cleanMessage,
        historyLength: historyMessages.length,
      });

      // Add timeout to graph execution (60 seconds for complex operations)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Graph execution timeout")), 60000),
      );

      try {
        const result = await Promise.race([
          this.graph.invoke(input),
          timeoutPromise,
        ]);

        console.log("Graph result:", {
          hasResponse: !!result.finalResponse,
          responseLength: result.finalResponse?.length,
        });
        
        if (result.finalResponse) {
          // Add user message and response to conversation history
          sessionHistory.push(
            { role: 'user', content: cleanMessage },
            { role: 'assistant', content: result.finalResponse }
          );
          this.conversationHistory.set(sessionId, sessionHistory);
        }
        
        return (
          result.finalResponse ||
          "I couldn't process your request. Please try again."
        );
      } catch (innerError) {
        console.error("Graph execution error:", innerError);
        throw innerError;
      }
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
