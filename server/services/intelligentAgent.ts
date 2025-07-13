import { AzureChatOpenAI } from "@langchain/azure-openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { MCPToolAdapter } from "./mcpToolAdapter.js";

/**
 * Intelligent Agent that can dynamically choose tools based on user requests
 * This replaces the rigid multi-agent orchestrator with a more flexible system
 */
export class IntelligentAgent {
  private azureOpenAI: AzureChatOpenAI | null = null;
  private mcpToolAdapter: MCPToolAdapter;
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private isInitialized: boolean = false;

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
      console.log("Intelligent Agent: Azure OpenAI configuration incomplete");
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
        timeout: 30000,
        maxRetries: 1,
        model: deploymentName,
      });
      console.log("Intelligent Agent: Azure OpenAI initialized successfully");
    } catch (error) {
      console.error("Intelligent Agent: Failed to initialize Azure OpenAI:", error);
    }
  }

  private async initializeTools(user?: any) {
    try {
      await this.mcpToolAdapter.initialize(user);
      this.isInitialized = true;
      console.log("Intelligent Agent: Tools initialized successfully");
    } catch (error) {
      console.error("Intelligent Agent: Failed to initialize tools:", error);
    }
  }

  /**
   * Generate intelligent response using available tools
   */
  async generateResponse(userMessage: string, isInitialSummary: boolean = false): Promise<string> {
    if (!this.azureOpenAI || !this.isInitialized) {
      return this.getFallbackResponse(userMessage, isInitialSummary);
    }

    try {
      // Add user message to conversation history
      this.conversationHistory.push({ role: "user", content: userMessage });

      // Get available tools
      const tools = this.mcpToolAdapter.getTools();
      
      // Analyze user request and determine which tools to use
      const toolsToCall = await this.determineToolsToCall(userMessage, isInitialSummary);
      
      // Execute the selected tools
      const toolResults: Array<{ tool: string; result: any }> = [];
      
      for (const toolInfo of toolsToCall) {
        const tool = tools.find(t => t.name === toolInfo.name);
        if (tool) {
          console.log(`Intelligent Agent: Executing tool: ${toolInfo.name}`);
          try {
            const result = await tool.invoke(toolInfo.args || {});
            toolResults.push({ tool: toolInfo.name, result });
          } catch (error) {
            console.error(`Tool ${toolInfo.name} failed:`, error);
            toolResults.push({ tool: toolInfo.name, result: `Error: ${error.message}` });
          }
        }
      }

      // Format the response based on tool results
      let finalResponse: string;
      
      if (toolResults.length > 0) {
        // Create a message with tool results
        const toolResultsMessage = toolResults.map(({ tool, result }) => {
          return `Tool "${tool}" result:\n${result}`;
        }).join('\n\n');

        // Get AI to format the response nicely
        const finalMessages = [
          new SystemMessage(this.createFormattingSystemMessage(isInitialSummary)),
          new HumanMessage(userMessage),
          new SystemMessage(`Here are the results from the tools:\n\n${toolResultsMessage}\n\nNow provide a helpful, formatted response to the user based on this data.`)
        ];

        const finalResponseResult = await this.azureOpenAI.invoke(finalMessages);
        finalResponse = finalResponseResult.content as string;
      } else {
        // No tools were called, generate a regular response
        const messages = [
          new SystemMessage(this.createSystemMessage(isInitialSummary)),
          ...this.conversationHistory.map(msg => 
            msg.role === "user" ? new HumanMessage(msg.content) : new SystemMessage(msg.content)
          )
        ];
        
        const response = await this.azureOpenAI.invoke(messages);
        finalResponse = response.content as string;
      }

      // Add response to conversation history
      this.conversationHistory.push({ role: "assistant", content: finalResponse });
      
      // Keep conversation history manageable
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      return finalResponse;

    } catch (error) {
      console.error("Intelligent Agent: Error generating response:", error);
      return this.getFallbackResponse(userMessage, isInitialSummary);
    }
  }

  /**
   * Determine which tools to call based on user message
   */
  private async determineToolsToCall(userMessage: string, isInitialSummary: boolean): Promise<Array<{ name: string; args?: any }>> {
    const toolsToCall: Array<{ name: string; args?: any }> = [];
    const messageLower = userMessage.toLowerCase();

    // Initial summary always needs calendar and task data
    if (isInitialSummary) {
      // Get next 3 days of events
      const today = new Date();
      const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      toolsToCall.push({
        name: "get_calendar_events",
        args: {
          calendarId: "primary",
          timeMin: today.toISOString(),
          timeMax: threeDaysLater.toISOString()
        }
      });
      toolsToCall.push({ name: "get_all_tasks" });
      return toolsToCall;
    }

    // Calendar-related requests
    if (messageLower.includes("calendar") || messageLower.includes("event") || messageLower.includes("schedule") || messageLower.includes("appointment")) {
      if (messageLower.includes("this year") || messageLower.includes("all") && messageLower.includes("year")) {
        toolsToCall.push({ name: "get_this_year_events" });
      } else if (messageLower.includes("this month") || messageLower.includes("month")) {
        toolsToCall.push({ name: "get_this_month_events" });
      } else if (messageLower.includes("this week") || messageLower.includes("week")) {
        toolsToCall.push({ name: "get_this_week_events" });
      } else if (messageLower.includes("today")) {
        toolsToCall.push({ name: "get_today_events" });
      } else {
        // Default to this week
        toolsToCall.push({ name: "get_this_week_events" });
      }
    }

    // Task-related requests
    if (messageLower.includes("task") || messageLower.includes("todo") || messageLower.includes("to do") || messageLower.includes("to-do")) {
      if (messageLower.includes("priority") || messageLower.includes("organized by priority")) {
        toolsToCall.push({ name: "get_all_tasks" });
      } else if (messageLower.includes("high priority") || messageLower.includes("urgent") || messageLower.includes("important")) {
        toolsToCall.push({ name: "get_high_priority_tasks" });
      } else if (messageLower.includes("overdue") || messageLower.includes("past due")) {
        toolsToCall.push({ name: "get_overdue_tasks" });
      } else if (messageLower.includes("today")) {
        toolsToCall.push({ name: "get_tasks_due_today" });
      } else if (messageLower.includes("this week")) {
        toolsToCall.push({ name: "get_tasks_due_this_week" });
      } else if (messageLower.includes("all") || messageLower.includes("list") || messageLower.includes("show")) {
        toolsToCall.push({ name: "get_all_tasks" });
      }
    }

    // If user asks for everything or their schedule
    if ((messageLower.includes("what do i have") || messageLower.includes("my schedule") || messageLower.includes("show me everything")) && toolsToCall.length === 0) {
      toolsToCall.push({ name: "get_this_week_events" });
      toolsToCall.push({ name: "get_all_tasks" });
    }

    return toolsToCall;
  }

  private createSystemMessage(isInitialSummary: boolean): string {
    return `You are an intelligent AI assistant that helps users manage their calendar and tasks using Google Calendar and Google Tasks APIs.

You have access to comprehensive tools that can:
- Get calendar events for any time period (today, this week, this month, this year, or custom ranges)
- Get tasks from all lists or specific lists
- Get high priority, overdue, or tasks due today/this week
- Create new calendar events and tasks
- List all calendars and task lists

IMPORTANT INSTRUCTIONS:
1. **Intelligent Tool Selection**: Analyze the user's request and choose the most appropriate tools
2. **Time Range Understanding**: When users ask for "this year", "this month", etc., use the corresponding time-specific tools
3. **Flexible Responses**: Don't be rigid - if user asks for "all events this year", use get_this_year_events tool
4. **Natural Language Processing**: Understand context and intent, not just keywords
5. **Comprehensive Responses**: Provide helpful, formatted responses based on the data

${isInitialSummary ? `
**INITIAL SUMMARY MODE**: This is an initial summary request. Provide a concise markdown-formatted summary showing:
- Upcoming calendar events (next 3 days)
- Important tasks
- Recommendations based on the data

Use markdown formatting with headers like:
## 📅 Next 3 Days
## ✅ Tasks
## 💡 Recommendations
` : `
**CONVERSATION MODE**: This is a regular conversation. Respond naturally to the user's request using appropriate tools and provide helpful information.
`}

Remember:
- Use tools intelligently based on user intent
- Format responses appropriately for the context
- Be helpful and informative
- Handle time ranges correctly (year, month, week, today, etc.)
- Organize information logically`;
  }

  private createFormattingSystemMessage(isInitialSummary: boolean): string {
    return `You are formatting the response for the user. Based on the tool results provided, create a helpful and well-formatted response.

${isInitialSummary ? `
**INITIAL SUMMARY FORMAT**: Create a markdown-formatted 3-day summary with:
## 📅 Next 3 Days
(List events chronologically)

## ✅ Tasks
(List important tasks organized appropriately)

## 💡 Recommendations
(Provide 3 actionable recommendations)
` : `
**CONVERSATION FORMAT**: Format the data appropriately for the user's request:
- If they asked for yearly events, show all events found
- If they asked for tasks by list, organize by task lists
- If they asked for priority tasks, organize by priority
- Use appropriate headers and formatting
`}

Keep responses concise, informative, and well-organized. Use markdown formatting for better readability.`;
  }

  private getFallbackResponse(userMessage: string, isInitialSummary: boolean): string {
    if (isInitialSummary) {
      return `## 📅 Next 3 Days
Unable to fetch calendar events - please check your Google Calendar connection.

## ✅ Tasks  
Unable to fetch tasks - please check your Google Tasks connection.

## 💡 Recommendations
1. Verify your Google account is properly connected
2. Check that you have granted Calendar and Tasks permissions
3. Try refreshing your connection if needed`;
    }

    return `I'm unable to process your request at the moment. Please ensure:
- Your Google account is properly connected
- You have granted necessary permissions for Calendar and Tasks
- Your internet connection is stable

Request: "${userMessage}"`;
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Get system status
   */
  getStatus(): Record<string, any> {
    return {
      azureOpenAI: this.azureOpenAI !== null,
      toolsInitialized: this.isInitialized,
      toolsReady: this.mcpToolAdapter.isReady(),
      conversationLength: this.conversationHistory.length,
    };
  }
}