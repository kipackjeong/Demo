import { StateGraph, END, START } from "@langchain/langgraph";
import { AzureChatOpenAI } from "@langchain/azure-openai";
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  ToolMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { MCPToolAdapter } from "./mcpToolAdapter.js";
import { DynamicStructuredTool } from "@langchain/core/tools";

// Define state for the orchestrator
interface OrchestratorState {
  userRequest: string;
  sessionId: string;
  routingDecision?: {
    agents: string[];
    reasoning: string;
  };
  agentResults?: {
    calendar?: any;
    tasks?: any;
    summary?: string;
  };
  finalResponse?: string;
  isInitialSummary?: boolean;
}

// Individual agent classes
class CalendarAgent {
  private model: AzureChatOpenAI;
  private tools: DynamicStructuredTool[];

  constructor(model: AzureChatOpenAI, tools: DynamicStructuredTool[]) {
    this.model = model;
    // Filter only calendar-related tools
    this.tools = tools.filter(tool => 
      tool.name.includes('calendar') || tool.name.includes('event')
    );
  }

  async process(request: string): Promise<any> {
    console.log("📅 CALENDAR AGENT: Processing request");
    
    const systemPrompt = `You are a Calendar specialist agent. Your role is to:
- Fetch calendar events and information
- Focus only on calendar-related queries
- Return structured calendar data

Always use the available calendar tools to fetch real data.`;

    try {
      const modelWithTools = this.model.bindTools(this.tools);
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(request)
      ];

      const response = await modelWithTools.invoke(messages);
      
      // If the model wants to use tools
      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log(`📅 Calendar Agent using ${response.tool_calls.length} tools`);
        
        const results = [];
        for (const toolCall of response.tool_calls) {
          const tool = this.tools.find(t => t.name === toolCall.function.name);
          if (tool) {
            const result = await tool.func(JSON.parse(toolCall.function.arguments));
            results.push(JSON.parse(result));
          }
        }
        
        return results.flat();
      }
      
      return [];
    } catch (error) {
      console.error("📅 Calendar Agent error:", error);
      return [];
    }
  }
}

class TasksAgent {
  private model: AzureChatOpenAI;
  private tools: DynamicStructuredTool[];

  constructor(model: AzureChatOpenAI, tools: DynamicStructuredTool[]) {
    this.model = model;
    // Filter only task-related tools
    this.tools = tools.filter(tool => 
      tool.name.includes('task') && !tool.name.includes('calendar')
    );
  }

  async process(request: string): Promise<any> {
    console.log("✅ TASKS AGENT: Processing request");
    
    const systemPrompt = `You are a Tasks specialist agent. Your role is to:
- Fetch and manage task lists and tasks
- Focus only on task-related queries
- Return structured task data

Always use the available task tools to fetch real data.`;

    try {
      const modelWithTools = this.model.bindTools(this.tools);
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(request)
      ];

      const response = await modelWithTools.invoke(messages);
      
      // If the model wants to use tools
      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log(`✅ Tasks Agent using ${response.tool_calls.length} tools`);
        
        const results = [];
        for (const toolCall of response.tool_calls) {
          const tool = this.tools.find(t => t.name === toolCall.function.name);
          if (tool) {
            const result = await tool.func(JSON.parse(toolCall.function.arguments));
            results.push(JSON.parse(result));
          }
        }
        
        return results.flat();
      }
      
      return [];
    } catch (error) {
      console.error("✅ Tasks Agent error:", error);
      return [];
    }
  }
}

class SummaryAgent {
  private model: AzureChatOpenAI;

  constructor(model: AzureChatOpenAI) {
    this.model = model;
  }

  async process(calendarData: any[], tasksData: any[], timeRange: string = "3 days"): Promise<string> {
    console.log("📝 SUMMARY AGENT: Creating summary");
    
    const systemPrompt = `You are a Summary specialist agent. Your role is to:
- Take raw calendar and task data and create a well-formatted summary
- Use markdown formatting with clear sections
- Provide helpful recommendations based on the data

Format the response EXACTLY like this:

## 📅 Next ${timeRange}

[List calendar events or "No events scheduled"]

## ✅ Tasks

[List tasks by priority or "No active tasks"]

## 💡 Recommendations

[3 actionable recommendations based on the calendar and tasks]`;

    try {
      const eventsSummary = calendarData.length > 0 
        ? `Calendar events: ${JSON.stringify(calendarData)}`
        : "No calendar events";
        
      const tasksSummary = tasksData.length > 0
        ? `Tasks: ${JSON.stringify(tasksData)}`
        : "No tasks";

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Create a summary for the next ${timeRange} with this data:\n${eventsSummary}\n${tasksSummary}`)
      ];

      const response = await this.model.invoke(messages);
      return response.content as string;
    } catch (error) {
      console.error("📝 Summary Agent error:", error);
      return "Unable to generate summary";
    }
  }
}

export class MultiAgentOrchestrator {
  private orchestratorModel: AzureChatOpenAI | null = null;
  private graph: StateGraph<OrchestratorState> | null = null;
  private mcpToolAdapter: MCPToolAdapter;
  private tools: DynamicStructuredTool[] = [];
  
  // Sub-agents
  private calendarAgent: CalendarAgent | null = null;
  private tasksAgent: TasksAgent | null = null;
  private summaryAgent: SummaryAgent | null = null;

  constructor(user?: any) {
    this.mcpToolAdapter = new MCPToolAdapter();
    this.initializeModels();
    this.initializeTools(user);
  }

  private initializeModels() {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME?.trim();
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-01";

    if (!endpoint || !deploymentName || !apiKey) {
      console.log("Azure OpenAI configuration incomplete");
      return;
    }

    try {
      // Create model for orchestrator
      this.orchestratorModel = new AzureChatOpenAI({
        azureOpenAIApiKey: apiKey,
        azureOpenAIEndpoint: endpoint,
        azureOpenAIApiDeploymentName: deploymentName,
        azureOpenAIApiVersion: apiVersion,
        temperature: 0.3, // Lower temperature for routing decisions
        maxTokens: 500,
      });

      // Create models for sub-agents
      const agentModel = new AzureChatOpenAI({
        azureOpenAIApiKey: apiKey,
        azureOpenAIEndpoint: endpoint,
        azureOpenAIApiDeploymentName: deploymentName,
        azureOpenAIApiVersion: apiVersion,
        temperature: 0.7,
        maxTokens: 2000,
      });

      console.log("Multi-Agent Orchestrator: Models initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Azure OpenAI:", error);
    }
  }

  private async initializeTools(user?: any) {
    try {
      await this.mcpToolAdapter.initialize(user);
      this.tools = this.mcpToolAdapter.getTools();
      
      if (this.orchestratorModel) {
        // Initialize sub-agents with their specific tools
        const agentModel = new AzureChatOpenAI({
          azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY!,
          azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT!,
          azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
          azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-02-01",
          temperature: 0.7,
          maxTokens: 2000,
        });

        this.calendarAgent = new CalendarAgent(agentModel, this.tools);
        this.tasksAgent = new TasksAgent(agentModel, this.tools);
        this.summaryAgent = new SummaryAgent(agentModel);
      }
      
      this.setupOrchestratorGraph();
      console.log("Multi-Agent Orchestrator: Tools and agents initialized");
    } catch (error) {
      console.error("Failed to initialize tools:", error);
    }
  }

  private setupOrchestratorGraph() {
    if (!this.orchestratorModel) {
      console.error("Cannot setup graph without orchestrator model");
      return;
    }

    const workflow = new StateGraph<OrchestratorState>({
      channels: {
        userRequest: null,
        sessionId: null,
        routingDecision: null,
        agentResults: null,
        finalResponse: null,
        isInitialSummary: null,
      },
    });

    // ORCHESTRATOR NODE - Analyzes request and routes to appropriate agents
    workflow.addNode("orchestrator", async (state: OrchestratorState) => {
      console.log("\n🎯 ORCHESTRATOR: Analyzing user request");
      
      const routingPrompt = `You are an orchestrator that routes requests to specialized agents.
Available agents:
- calendar: Handles calendar events, scheduling, and time-based queries
- tasks: Handles task lists, to-dos, and task management
- summary: Creates formatted summaries from collected data

Analyze this request and decide which agents to invoke: "${state.userRequest}"

Respond in JSON format:
{
  "agents": ["agent1", "agent2"],
  "reasoning": "Brief explanation of routing decision"
}`;

      try {
        const response = await this.orchestratorModel!.invoke([
          new SystemMessage(routingPrompt),
          new HumanMessage(state.userRequest)
        ]);

        const content = response.content as string;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const decision = JSON.parse(jsonMatch[0]);
          console.log("🎯 Routing decision:", decision);
          return { routingDecision: decision };
        }
        
        // Default routing for initial summary
        if (state.isInitialSummary) {
          return {
            routingDecision: {
              agents: ["calendar", "tasks", "summary"],
              reasoning: "Initial summary requires calendar, tasks, and formatting"
            }
          };
        }
        
        return {
          routingDecision: {
            agents: ["summary"],
            reasoning: "Default to summary agent"
          }
        };
      } catch (error) {
        console.error("🎯 Orchestrator error:", error);
        return {
          routingDecision: {
            agents: ["summary"],
            reasoning: "Error in routing, defaulting to summary"
          }
        };
      }
    });

    // PARALLEL AGENT EXECUTION NODE
    workflow.addNode("executeAgents", async (state: OrchestratorState) => {
      console.log("\n⚡ EXECUTING AGENTS:", state.routingDecision?.agents);
      
      const results: any = {
        calendar: null,
        tasks: null,
        summary: null,
      };

      const agents = state.routingDecision?.agents || [];
      
      // Execute agents in parallel where possible
      const promises = [];
      
      if (agents.includes("calendar") && this.calendarAgent) {
        promises.push(
          this.calendarAgent.process(state.userRequest)
            .then(data => { results.calendar = data; })
            .catch(err => console.error("Calendar agent failed:", err))
        );
      }
      
      if (agents.includes("tasks") && this.tasksAgent) {
        promises.push(
          this.tasksAgent.process(state.userRequest)
            .then(data => { results.tasks = data; })
            .catch(err => console.error("Tasks agent failed:", err))
        );
      }
      
      // Wait for data collection agents to complete
      await Promise.all(promises);
      
      // Now run summary agent if needed (it depends on the data)
      if (agents.includes("summary") && this.summaryAgent) {
        const calendarData = results.calendar || [];
        const tasksData = results.tasks || [];
        
        results.summary = await this.summaryAgent.process(
          calendarData,
          tasksData,
          state.isInitialSummary ? "3 days" : "week"
        );
      }
      
      console.log("⚡ Agent execution complete");
      return { agentResults: results };
    });

    // AGGREGATOR NODE - Combines results from all agents
    workflow.addNode("aggregator", async (state: OrchestratorState) => {
      console.log("\n📊 AGGREGATOR: Combining agent results");
      
      const results = state.agentResults || {};
      
      // If we have a summary, use it as the final response
      if (results.summary) {
        return { finalResponse: results.summary };
      }
      
      // Otherwise, create a simple response from the data
      let response = "";
      
      if (results.calendar) {
        response += `Calendar: ${JSON.stringify(results.calendar, null, 2)}\n\n`;
      }
      
      if (results.tasks) {
        response += `Tasks: ${JSON.stringify(results.tasks, null, 2)}\n\n`;
      }
      
      if (!response) {
        response = "No data found for your request.";
      }
      
      return { finalResponse: response };
    });

    // Set up the edges
    workflow.addEdge(START, "orchestrator");
    workflow.addEdge("orchestrator", "executeAgents");
    workflow.addEdge("executeAgents", "aggregator");
    workflow.addEdge("aggregator", END);

    // Compile the graph
    this.graph = workflow.compile();
    console.log("Multi-Agent Orchestrator: Graph compiled successfully");
  }

  async process(userMessage: string, sessionId: string): Promise<string> {
    if (!this.graph) {
      return "System not properly initialized. Please try again later.";
    }

    try {
      console.log("\n🚀 STARTING MULTI-AGENT ORCHESTRATION");
      
      const isInitialSummary = userMessage.includes("[INITIAL_SUMMARY]");
      const cleanMessage = userMessage.replace("[INITIAL_SUMMARY]", "").trim();

      const input: OrchestratorState = {
        userRequest: cleanMessage,
        sessionId,
        isInitialSummary,
      };

      const result = await this.graph.invoke(input);
      
      console.log("🏁 ORCHESTRATION COMPLETE");
      return result.finalResponse || "Unable to process your request.";
    } catch (error) {
      console.error("Multi-agent orchestration error:", error);
      return "I encountered an error while processing your request. Please try again.";
    }
  }

  getSystemStatus(): Record<string, any> {
    return {
      orchestrator: this.orchestratorModel ? "ready" : "not ready",
      graph: this.graph ? "compiled" : "not compiled",
      agents: {
        calendar: this.calendarAgent ? "ready" : "not ready",
        tasks: this.tasksAgent ? "ready" : "not ready",
        summary: this.summaryAgent ? "ready" : "not ready",
      },
      tools: this.tools.length,
    };
  }
}