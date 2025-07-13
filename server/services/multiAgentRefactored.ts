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

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(state.userMessage),
        ...state.messages,
      ];

      console.log("\n=== AGENT NODE EXECUTION ===");
      console.log("Agent node executing with", this.tools.length, "tools");
      console.log("Current state messages:", state.messages.length);
      console.log(
        "Message types:",
        state.messages.map((m) => m.constructor.name),
      );
      console.log("User message:", state.userMessage);

      try {
        console.log("Invoking model without tools first...");
        // First, let's try without tools to see if the model responds
        const simpleResponse = await this.azureOpenAI!.invoke(messages);
        console.log("AGENT RESPONSE:", simpleResponse.content?.toString());

        // For initial summary, we need to manually create tool calls only if we haven't called tools yet
        if (state.isInitialSummary && state.messages.length === 0) {
          // Create manual tool calls for calendar and tasks
          const toolCalls = [
            {
              id: "call_1",
              type: "function" as const,
              function: {
                name: "get_calendar_events",
                arguments: JSON.stringify({
                  calendarId: "primary",
                  timeMin: new Date().toISOString(),
                  timeMax: new Date(
                    Date.now() + 3 * 24 * 60 * 60 * 1000,
                  ).toISOString(), // 3 days from now
                }),
              },
            },
            {
              id: "call_2",
              type: "function" as const,
              function: {
                name: "get_tasks",
                arguments: JSON.stringify({
                  taskListId: "@default",
                }),
              },
            },
          ];

          const responseWithTools = new AIMessage({
            content:
              "Let me fetch your calendar events and tasks for the week.",
            tool_calls: toolCalls,
          });

          return { messages: [responseWithTools] };
        }

        // If we're processing after tools have been called, ask the model to format the response
        const hasToolMessages = state.messages.some(
          (m) => m.constructor.name === "ToolMessage",
        );
        if (state.isInitialSummary && hasToolMessages) {
          // Extract tool results
          let calendarData: any[] = [];
          let tasksData: any[] = [];

          for (const message of state.messages) {
            if (message.constructor.name === "ToolMessage") {
              try {
                const toolMessage = message as any;
                const result = JSON.parse(toolMessage.content);

                // Check if this is calendar data
                if (Array.isArray(result) && result.length > 0) {
                  if (result[0].hasOwnProperty("start")) {
                    calendarData = result;
                  } else if (
                    result[0].hasOwnProperty("notes") ||
                    result[0].hasOwnProperty("title")
                  ) {
                    tasksData = result;
                  }
                }
              } catch (e) {
                console.log("Error parsing tool message:", e);
              }
            }
          }

          // Create formatted response
          let formattedResponse = "## 📅 This Week's Calendar\n\n";

          if (calendarData.length > 0) {
            for (const event of calendarData) {
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
            }
          } else {
            formattedResponse += "No events scheduled this week.\n";
          }

          formattedResponse += "\n## ✅ Tasks\n\n";

          if (tasksData.length > 0) {
            const highPriority = tasksData.filter((t) => t.priority === "high");
            const mediumPriority = tasksData.filter(
              (t) => t.priority === "medium",
            );
            const lowPriority = tasksData.filter((t) => t.priority === "low");

            if (highPriority.length > 0) {
              formattedResponse += "### High Priority\n";
              for (const task of highPriority) {
                formattedResponse += `- ${task.title}`;
                if (task.dueDate) {
                  formattedResponse += ` (Due: ${new Date(task.dueDate).toLocaleDateString()})`;
                }
                formattedResponse += "\n";
              }
              formattedResponse += "\n";
            }

            if (mediumPriority.length > 0) {
              formattedResponse += "### Medium Priority\n";
              for (const task of mediumPriority) {
                formattedResponse += `- ${task.title}`;
                if (task.dueDate) {
                  formattedResponse += ` (Due: ${new Date(task.dueDate).toLocaleDateString()})`;
                }
                formattedResponse += "\n";
              }
              formattedResponse += "\n";
            }

            if (lowPriority.length > 0) {
              formattedResponse += "### Low Priority\n";
              for (const task of lowPriority) {
                formattedResponse += `- ${task.title}`;
                if (task.dueDate) {
                  formattedResponse += ` (Due: ${new Date(task.dueDate).toLocaleDateString()})`;
                }
                formattedResponse += "\n";
              }
              formattedResponse += "\n";
            }
          } else {
            formattedResponse += "No active tasks.\n\n";
          }

          formattedResponse += "## 💡 Recommendations\n\n";
          formattedResponse +=
            "1. Review your upcoming events and prepare any necessary materials\n";
          formattedResponse +=
            "2. Focus on completing high-priority tasks first\n";
          formattedResponse +=
            "3. Consider scheduling time for any overdue tasks\n";

          const finalResponse = new AIMessage(formattedResponse);
          console.log(
            "Formatting response generated directly from tool results",
          );
          return { messages: [finalResponse] };
        }

        // For regular messages, use the simple response we already got
        const responseText = simpleResponse.content?.toString() || "";
        
        // Check if the response indicates it needs tools
        const needsTools = responseText.toLowerCase().includes("let me") || 
                          responseText.toLowerCase().includes("i'll") ||
                          responseText.toLowerCase().includes("fetching") ||
                          responseText.toLowerCase().includes("checking");
        
        if (!needsTools && !state.isInitialSummary) {
          console.log("Simple conversational response - no tools needed");
          return { messages: [simpleResponse] };
        }
        
        // Otherwise, directly execute the necessary tools based on the request
        console.log("Response needs tools, executing directly");
        
        // Parse the user message to determine what tools to call
        const userMessage = state.userMessage.toLowerCase();
        const toolResults = [];
        
        try {
          if (userMessage.includes("create") && userMessage.includes("task")) {
            // Extract task details from the message
            const titleMatch = userMessage.match(/["']([^"']+)["']/);
            const taskTitle = titleMatch ? titleMatch[1] : "New Task";
            
            // Find task list name
            const listMatch = userMessage.match(/in the ["']([^"']+)["'] list/i);
            const taskList = listMatch ? listMatch[1] : "My Tasks";
            
            // Determine priority
            const priority = userMessage.includes("high priority") ? "high" : 
                           userMessage.includes("low priority") ? "low" : "medium";
            
            console.log(`Creating task: "${taskTitle}" in list "${taskList}" with ${priority} priority`);
            
            // Find the create_task tool
            const createTaskTool = this.tools.find(t => t.name === "create_task");
            if (createTaskTool) {
              const result = await createTaskTool.func({
                taskListId: taskList,
                title: taskTitle,
                notes: "",
                priority: priority
              });
              
              toolResults.push({
                tool: "create_task",
                result: result
              });
            }
          }
          
          // Format the response based on tool results
          let responseText = "";
          if (toolResults.length > 0 && toolResults[0].result) {
            const taskResult = JSON.parse(toolResults[0].result);
            if (taskResult.error) {
              responseText = `I encountered an error creating the task: ${taskResult.error}`;
            } else {
              responseText = `✓ I've created the task "${taskResult.title}" in the "${taskResult.taskListTitle || 'My Tasks'}" list with ${taskResult.priority || 'medium'} priority.`;
              if (taskResult.id) {
                responseText += ` The task ID is ${taskResult.id}.`;
              }
            }
          } else {
            responseText = simpleResponse.content?.toString() || "";
          }
          
          const finalResponse = new AIMessage(responseText);
          return { messages: [finalResponse] };
          
        } catch (error) {
          console.error("Error executing tools directly:", error);
          const errorResponse = new AIMessage(
            "I understand you want to create a task, but I encountered an error. Please try again."
          );
          return { messages: [errorResponse] };
        }
      } catch (error) {
        console.error("Error invoking model:", error);
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

      // For initial summaries, ensure proper formatting
      if (state.isInitialSummary && finalResponse) {
        console.log("Applying initial summary formatting...");
        finalResponse = this.formatInitialSummary(
          finalResponse,
          state.messages,
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

  private formatInitialSummary(
    response: string,
    messages: BaseMessage[],
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
    let formattedResponse = "## 📅 Next 3 Days\n\n";

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
      formattedResponse += "No events scheduled for the next 3 days.\n";
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

      const input: LifeManagerState = {
        messages: [],
        userMessage: cleanMessage,
        sessionId,
        isInitialSummary,
      };

      console.log("Processing request with graph:", {
        isInitialSummary,
        cleanMessage,
      });

      // Add timeout to graph execution (reduced to 30 seconds)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Graph execution timeout")), 30000),
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
