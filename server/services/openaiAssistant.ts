import OpenAI from "openai";
import { MCPToolAdapter } from "./mcpToolAdapter.js";

/**
 * OpenAI Assistant-based agent with dynamic tool handling
 * This replaces the Azure OpenAI implementation with better tool support
 */
export class OpenAIAssistantAgent {
  private openai: OpenAI;
  private assistant: OpenAI.Beta.Assistant | null = null;
  private mcpToolAdapter: MCPToolAdapter;
  private threads: Map<string, string> = new Map(); // sessionId -> threadId
  private isInitialized: boolean = false;

  constructor(user?: any) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    this.openai = new OpenAI({ apiKey });
    this.mcpToolAdapter = new MCPToolAdapter();
    this.initializeAssistant(user);
  }

  private async initializeAssistant(user?: any) {
    try {
      // Initialize MCP tools
      await this.mcpToolAdapter.initialize(user);
      
      // Convert MCP tools to OpenAI function format
      const tools = this.mcpToolAdapter.getTools();
      const openaiTools = tools.map(tool => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: "object",
            properties: tool.schema ? this.zodToJsonSchema(tool.schema) : {},
            required: tool.schema ? this.getRequiredFields(tool.schema) : []
          }
        }
      }));

      // Create or update assistant with tools
      const assistants = await this.openai.beta.assistants.list();
      const existingAssistant = assistants.data.find(a => a.name === "Calendar and Task Manager");

      if (existingAssistant) {
        // Update existing assistant with new tools
        this.assistant = await this.openai.beta.assistants.update(existingAssistant.id, {
          tools: openaiTools,
          model: "gpt-4o",
          instructions: this.getAssistantInstructions()
        });
        console.log("OpenAI Assistant: Updated existing assistant");
      } else {
        // Create new assistant
        this.assistant = await this.openai.beta.assistants.create({
          name: "Calendar and Task Manager",
          instructions: this.getAssistantInstructions(),
          tools: openaiTools,
          model: "gpt-4o"
        });
        console.log("OpenAI Assistant: Created new assistant");
      }

      this.isInitialized = true;
      console.log(`OpenAI Assistant initialized with ${openaiTools.length} tools`);
    } catch (error) {
      console.error("Failed to initialize OpenAI Assistant:", error);
      throw error;
    }
  }

  /**
   * Convert Zod schema to JSON Schema format for OpenAI
   */
  private zodToJsonSchema(zodSchema: any): any {
    const properties: any = {};
    
    if (zodSchema._def && zodSchema._def.shape) {
      const shape = zodSchema._def.shape();
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = this.zodFieldToJsonSchema(value as any);
      }
    }
    
    return properties;
  }

  private zodFieldToJsonSchema(field: any): any {
    const fieldDef = field._def;
    
    if (fieldDef.typeName === "ZodString") {
      return {
        type: "string",
        description: fieldDef.description || undefined,
        default: fieldDef.defaultValue ? fieldDef.defaultValue() : undefined
      };
    } else if (fieldDef.typeName === "ZodNumber") {
      return {
        type: "number",
        description: fieldDef.description || undefined
      };
    } else if (fieldDef.typeName === "ZodBoolean") {
      return {
        type: "boolean",
        description: fieldDef.description || undefined
      };
    } else if (fieldDef.typeName === "ZodArray") {
      return {
        type: "array",
        items: { type: "string" },
        description: fieldDef.description || undefined
      };
    } else if (fieldDef.typeName === "ZodOptional") {
      return this.zodFieldToJsonSchema(fieldDef.innerType);
    } else if (fieldDef.typeName === "ZodDefault") {
      const schema = this.zodFieldToJsonSchema(fieldDef.innerType);
      schema.default = fieldDef.defaultValue();
      return schema;
    }
    
    return { type: "string" };
  }

  private getRequiredFields(zodSchema: any): string[] {
    const required: string[] = [];
    
    if (zodSchema._def && zodSchema._def.shape) {
      const shape = zodSchema._def.shape();
      for (const [key, value] of Object.entries(shape)) {
        const fieldDef = (value as any)._def;
        if (fieldDef.typeName !== "ZodOptional" && fieldDef.typeName !== "ZodDefault") {
          required.push(key);
        }
      }
    }
    
    return required;
  }

  private getAssistantInstructions(): string {
    return `You are an intelligent AI assistant that helps users manage their calendar and tasks using Google Calendar and Google Tasks APIs.

You have access to comprehensive tools that can:
- Get calendar events for any time period (today, this week, this month, this year, or custom ranges)
- Get all tasks or tasks from specific lists
- Get high priority, overdue, or tasks due today/this week
- Create new calendar events and tasks
- List all calendars and task lists

IMPORTANT INSTRUCTIONS:
1. **Intelligent Tool Selection**: Analyze the user's request and choose the most appropriate tools
2. **Time Range Understanding**: 
   - When users ask for "all scheduled events this year", use get_this_year_events tool
   - When users ask for "this month", use get_this_month_events tool
   - Be precise with time ranges
3. **Task Organization**: 
   - When users ask for "all tasks organized by priority", use get_all_tasks and organize by priority
   - When users ask for "tasks organized by list", use get_all_tasks and organize by task list
4. **Natural Language Processing**: Understand context and intent, not just keywords
5. **Comprehensive Responses**: Provide helpful, well-formatted responses based on the data

For initial summaries, provide a concise markdown-formatted summary showing:
## 📅 Next 3 Days
(List upcoming events)

## ✅ Tasks
(List important tasks)

## 💡 Recommendations
(Provide 3 actionable recommendations)

For regular requests, format responses appropriately based on what the user is asking for.`;
  }

  /**
   * Generate response using OpenAI Assistant
   */
  async generateResponse(userMessage: string, sessionId: string, isInitialSummary: boolean = false): Promise<string> {
    if (!this.isInitialized || !this.assistant) {
      console.log("OpenAI Assistant not initialized properly");
      return this.getFallbackResponse(userMessage, isInitialSummary);
    }

    try {
      // Get or create thread for this session
      let threadId = this.threads.get(sessionId);
      if (!threadId) {
        const thread = await this.openai.beta.threads.create();
        threadId = thread.id;
        this.threads.set(sessionId, threadId);
        console.log(`Created new thread ${threadId} for session ${sessionId}`);
      }

      console.log(`Adding message to thread ${threadId}: "${userMessage}"`);
      // Add message to thread
      await this.openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: userMessage
      });

      // Run the assistant
      console.log(`Running assistant ${this.assistant.id} on thread ${threadId}`);
      const run = await this.openai.beta.threads.runs.create(threadId, {
        assistant_id: this.assistant.id
      });

      // Wait for completion and handle tool calls
      let runStatus = await this.openai.beta.threads.runs.retrieve(threadId, run.id);
      console.log(`Initial run status: ${runStatus.status}`);
      
      let iterations = 0;
      const maxIterations = 30; // 30 seconds max wait
      
      while (runStatus.status !== "completed" && runStatus.status !== "failed" && iterations < maxIterations) {
        console.log(`Run status: ${runStatus.status} (iteration ${iterations})`);
        
        if (runStatus.status === "requires_action" && runStatus.required_action?.type === "submit_tool_outputs") {
          const toolCalls = runStatus.required_action.submit_tool_outputs.tool_calls;
          console.log(`Handling ${toolCalls.length} tool calls`);
          const toolOutputs = await this.handleToolCalls(toolCalls);
          
          // Submit tool outputs
          console.log("Submitting tool outputs");
          await this.openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
            tool_outputs: toolOutputs
          });
        }
        
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await this.openai.beta.threads.runs.retrieve(threadId, run.id);
        iterations++;
      }

      console.log(`Final run status: ${runStatus.status}`);

      if (runStatus.status === "failed") {
        console.error("Assistant run failed:", runStatus.last_error);
        return this.getFallbackResponse(userMessage, isInitialSummary);
      }

      if (iterations >= maxIterations) {
        console.error("Assistant run timed out");
        return this.getFallbackResponse(userMessage, isInitialSummary);
      }

      // Get the assistant's response
      const messages = await this.openai.beta.threads.messages.list(threadId);
      const lastMessage = messages.data[0];
      
      console.log(`Got response from assistant: ${lastMessage.role}`);
      
      if (lastMessage.role === "assistant" && lastMessage.content[0].type === "text") {
        const response = lastMessage.content[0].text.value;
        console.log(`Assistant response preview: ${response.substring(0, 100)}...`);
        return response;
      }

      console.log("No valid assistant response found");
      return this.getFallbackResponse(userMessage, isInitialSummary);

    } catch (error) {
      console.error("OpenAI Assistant error:", error);
      console.error("Error details:", error.message);
      if (error.response) {
        console.error("API response:", error.response.data);
      }
      return this.getFallbackResponse(userMessage, isInitialSummary);
    }
  }

  /**
   * Handle tool calls from the assistant
   */
  private async handleToolCalls(toolCalls: any[]): Promise<any[]> {
    const toolOutputs = [];
    const tools = this.mcpToolAdapter.getTools();
    console.log(`Available tools: ${tools.map(t => t.name).join(', ')}`);

    for (const toolCall of toolCalls) {
      console.log(`Processing tool call: ${toolCall.function.name} with args: ${toolCall.function.arguments}`);
      const tool = tools.find(t => t.name === toolCall.function.name);
      
      if (tool) {
        try {
          console.log(`Executing tool: ${toolCall.function.name}`);
          const args = JSON.parse(toolCall.function.arguments);
          const result = await tool.invoke(args);
          console.log(`Tool ${toolCall.function.name} result preview: ${JSON.stringify(result).substring(0, 200)}...`);
          
          toolOutputs.push({
            tool_call_id: toolCall.id,
            output: typeof result === "string" ? result : JSON.stringify(result)
          });
        } catch (error) {
          console.error(`Tool ${toolCall.function.name} failed:`, error);
          console.error("Error details:", error.message);
          toolOutputs.push({
            tool_call_id: toolCall.id,
            output: JSON.stringify({ error: error.message })
          });
        }
      } else {
        console.error(`Tool not found: ${toolCall.function.name}`);
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: JSON.stringify({ error: "Tool not found" })
        });
      }
    }

    console.log(`Returning ${toolOutputs.length} tool outputs`);
    return toolOutputs;
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
   * Clear conversation for a session
   */
  clearSession(sessionId: string) {
    const threadId = this.threads.get(sessionId);
    if (threadId) {
      // Note: OpenAI doesn't provide a way to delete threads via API
      // We just remove it from our mapping
      this.threads.delete(sessionId);
    }
  }

  /**
   * Get system status
   */
  getStatus(): Record<string, any> {
    return {
      initialized: this.isInitialized,
      assistantId: this.assistant?.id || null,
      activeThreads: this.threads.size,
      toolsReady: this.mcpToolAdapter.isReady()
    };
  }
}