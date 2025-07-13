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
  private initializationPromise: Promise<void> | null = null;
  private threadCreationLocks: Map<string, Promise<string>> = new Map(); // sessionId -> Promise<threadId>
  private activeRuns: Map<string, string> = new Map(); // threadId -> runId
  private runLocks: Map<string, Promise<string>> = new Map(); // sessionId -> Promise<response>

  constructor(user?: any) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    this.openai = new OpenAI({ apiKey });
    this.mcpToolAdapter = new MCPToolAdapter();
    this.initializationPromise = this.initializeAssistant(user);
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
    // Check if there's already an active request for this session
    const existingRequest = this.runLocks.get(sessionId);
    if (existingRequest) {
      console.log(`Request already in progress for session ${sessionId}, waiting...`);
      return await existingRequest;
    }

    // Create a new request promise
    const requestPromise = this.processRequest(userMessage, sessionId, isInitialSummary);
    this.runLocks.set(sessionId, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up the lock
      this.runLocks.delete(sessionId);
    }
  }

  private async processRequest(userMessage: string, sessionId: string, isInitialSummary: boolean): Promise<string> {
    // Wait for initialization to complete
    if (this.initializationPromise) {
      console.log("Waiting for OpenAI Assistant initialization to complete...");
      try {
        await this.initializationPromise;
      } catch (error) {
        console.error("Failed to initialize OpenAI Assistant:", error);
        return this.getFallbackResponse(userMessage, isInitialSummary);
      }
    }
    
    if (!this.isInitialized || !this.assistant) {
      console.log("OpenAI Assistant not initialized properly");
      return this.getFallbackResponse(userMessage, isInitialSummary);
    }

    let threadId: string | undefined;
    
    try {
      // Get or create thread for this session with locking to prevent race conditions
      threadId = this.threads.get(sessionId);
      if (!threadId) {
        // Check if thread creation is already in progress
        const existingCreation = this.threadCreationLocks.get(sessionId);
        if (existingCreation) {
          console.log(`Waiting for existing thread creation for session ${sessionId}`);
          threadId = await existingCreation;
        } else {
          // Create thread creation promise
          const threadCreationPromise = (async () => {
            try {
              const thread = await this.openai.beta.threads.create();
              const newThreadId = thread.id;
              this.threads.set(sessionId, newThreadId);
              console.log(`Created new thread ${newThreadId} for session ${sessionId}`);
              return newThreadId;
            } finally {
              // Clean up the lock after creation
              this.threadCreationLocks.delete(sessionId);
            }
          })();
          
          this.threadCreationLocks.set(sessionId, threadCreationPromise);
          threadId = await threadCreationPromise;
        }
      }

      // Check if thread already has an active run BEFORE adding message
      const activeRunId = this.activeRuns.get(threadId);
      if (activeRunId) {
        console.log(`Thread ${threadId} already has active run ${activeRunId}, waiting for completion...`);
        try {
          const existingRun = await this.openai.beta.threads.runs.retrieve(threadId, activeRunId);
          if (existingRun.status === 'in_progress' || existingRun.status === 'requires_action') {
            console.log(`Existing run is still active with status: ${existingRun.status}`);
            // Wait for the existing run to complete
            let runStatus = existingRun;
            let iterations = 0;
            const maxIterations = 30;
            
            while (runStatus.status !== "completed" && runStatus.status !== "failed" && iterations < maxIterations) {
              if (runStatus.status === "requires_action" && runStatus.required_action?.type === "submit_tool_outputs") {
                const toolCalls = runStatus.required_action.submit_tool_outputs.tool_calls;
                console.log(`Handling ${toolCalls.length} tool calls for existing run`);
                const toolOutputs = await this.handleToolCalls(toolCalls);
                
                await this.openai.beta.threads.runs.submitToolOutputs(threadId, activeRunId, {
                  tool_outputs: toolOutputs
                });
              }
              
              await new Promise(resolve => setTimeout(resolve, 1000));
              runStatus = await this.openai.beta.threads.runs.retrieve(threadId, activeRunId);
              iterations++;
            }
            
            // Clean up the active run
            this.activeRuns.delete(threadId);
            
            // Check the final status
            if (runStatus.status === "completed") {
              console.log("Previous run completed, now adding new message");
            } else {
              console.log(`Previous run ended with status: ${runStatus.status}`);
            }
          }
        } catch (error) {
          console.error(`Error checking existing run: ${error.message}`);
          // Clean up and continue
          this.activeRuns.delete(threadId);
        }
      }

      console.log(`Adding message to thread ${threadId}: "${userMessage}"`);
      // Add message to thread
      await this.openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: userMessage
      });
      if (activeRunId) {
        console.log(`Thread ${threadId} already has active run ${activeRunId}, checking status...`);
        try {
          const existingRun = await this.openai.beta.threads.runs.retrieve(threadId, activeRunId);
          if (existingRun.status === 'in_progress' || existingRun.status === 'requires_action') {
            console.log(`Existing run is still active with status: ${existingRun.status}`);
            // Wait for the existing run to complete
            let runStatus = existingRun;
            let iterations = 0;
            const maxIterations = 30;
            
            while (runStatus.status !== "completed" && runStatus.status !== "failed" && iterations < maxIterations) {
              if (runStatus.status === "requires_action" && runStatus.required_action?.type === "submit_tool_outputs") {
                const toolCalls = runStatus.required_action.submit_tool_outputs.tool_calls;
                console.log(`Handling ${toolCalls.length} tool calls for existing run`);
                const toolOutputs = await this.handleToolCalls(toolCalls);
                
                await this.openai.beta.threads.runs.submitToolOutputs(threadId, activeRunId, {
                  tool_outputs: toolOutputs
                });
              }
              
              await new Promise(resolve => setTimeout(resolve, 1000));
              runStatus = await this.openai.beta.threads.runs.retrieve(threadId, activeRunId);
              iterations++;
            }
            
            // Clean up the active run
            this.activeRuns.delete(threadId);
            
            // Get the response from the completed run
            const messages = await this.openai.beta.threads.messages.list(threadId);
            const lastMessage = messages.data[0];
            
            if (lastMessage.role === "assistant" && lastMessage.content[0].type === "text") {
              return lastMessage.content[0].text.value;
            }
          }
        } catch (error) {
          console.error(`Error checking existing run: ${error.message}`);
          // Clean up and continue with new run
          this.activeRuns.delete(threadId);
        }
      }

      // Run the assistant
      console.log(`Running assistant ${this.assistant.id} on thread ${threadId}`);
      let run;
      try {
        run = await this.openai.beta.threads.runs.create(threadId, {
          assistant_id: this.assistant.id
        });
        console.log("Full run object:", JSON.stringify(run, null, 2));
        console.log(`Created run with ID: ${run.id} on thread ${threadId}`);
        
        if (!run.id) {
          console.error("ERROR: Run created but no ID returned!");
          console.error("Run object:", run);
          throw new Error("Run creation failed - no ID returned");
        }
        
        // Store the active run
        this.activeRuns.set(threadId, run.id);
      } catch (error) {
        console.error("Failed to create run:", error);
        console.error("Error details:", error.message);
        throw error;
      }

      // Wait for completion and handle tool calls
      console.log(`About to retrieve run. threadId: ${threadId}, runId: ${run.id}`);
      console.log(`Type of threadId: ${typeof threadId}, Type of runId: ${typeof run.id}`);
      
      let runStatus;
      try {
        // Double-check the values before the call
        if (!threadId || !run.id) {
          throw new Error(`Invalid parameters: threadId=${threadId}, runId=${run.id}`);
        }
        
        // Log the exact values and their types
        console.log("Calling runs.retrieve with:");
        console.log("  - First param (threadId):", threadId, "Type:", typeof threadId);
        console.log("  - Second param (run.id):", run.id, "Type:", typeof run.id);
        
        runStatus = await this.openai.beta.threads.runs.retrieve(
          threadId,
          run.id
        );
      } catch (retrieveError) {
        console.error("Error during run retrieve:");
        console.error("Parameters passed: threadId =", threadId, "runId =", run.id);
        console.error("Error:", retrieveError);
        throw retrieveError;
      }
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

      // Clean up the active run
      this.activeRuns.delete(threadId);

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
      
      // Clean up any active run for this thread
      if (threadId) {
        this.activeRuns.delete(threadId);
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