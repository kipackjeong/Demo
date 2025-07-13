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
    
    try {
      // For initial summary, we know we need to get calendar events
      // So let's call the tool directly instead of asking the model
      const calendarTool = this.tools.find(t => t.name === 'get_calendar_events');
      
      if (calendarTool) {
        console.log("📅 Calendar Agent: Directly calling get_calendar_events tool");
        const timeMin = new Date().toISOString();
        const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
        
        const result = await calendarTool.func({
          calendarId: 'primary',
          timeMin: timeMin,
          timeMax: timeMax
        });
        
        console.log("📅 Calendar Agent: Tool executed successfully");
        return JSON.parse(result);
      }
      
      console.log("📅 Calendar Agent: No calendar tool found");
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
    
    try {
      // For initial summary, we know we need to get tasks
      // So let's call the tool directly instead of asking the model
      const tasksTool = this.tools.find(t => t.name === 'get_tasks');
      
      if (tasksTool) {
        console.log("✅ Tasks Agent: Directly calling get_tasks tool");
        
        const result = await tasksTool.func({
          taskListId: '@default'
        });
        
        console.log("✅ Tasks Agent: Tool executed successfully");
        return JSON.parse(result);
      }
      
      console.log("✅ Tasks Agent: No tasks tool found");
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
    console.log(`Processing ${calendarData.length} calendar events and ${tasksData.length} tasks`);
    
    try {
      // Instead of using the model, let's format the summary directly
      let formattedResponse = `## 📅 Next ${timeRange}\n\n`;
      
      // Format calendar events
      if (calendarData.length > 0) {
        const sortedEvents = calendarData.sort((a, b) => 
          new Date(a.start || a.startTime).getTime() - new Date(b.start || b.startTime).getTime()
        );
        
        for (const event of sortedEvents) {
          // Handle different date formats from mock data
          const startDateStr = event.start || event.startTime || event.date;
          const startDate = new Date(startDateStr);
          
          // Check if date is valid
          let dateTimeStr = '';
          if (!isNaN(startDate.getTime())) {
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
            dateTimeStr = `${dateStr}, ${timeStr}`;
          } else if (event.date && event.time) {
            // Handle separate date and time fields from mock data
            dateTimeStr = `${event.date}, ${event.time}`;
          } else {
            dateTimeStr = 'Date TBD';
          }
          
          formattedResponse += `- **${event.title || event.summary || 'Untitled Event'}** - ${dateTimeStr}\n`;
          if (event.location) {
            formattedResponse += `  Location: ${event.location}\n`;
          }
          if (event.description) {
            formattedResponse += `  ${event.description}\n`;
          }
          formattedResponse += "\n";
        }
      } else {
        formattedResponse += `No events scheduled for the next ${timeRange}.\n`;
      }
      
      formattedResponse += "\n## ✅ Tasks\n\n";
      
      // Format tasks
      if (tasksData.length > 0) {
        const activeTasks = tasksData.filter(task => task.status !== 'completed');
        
        if (activeTasks.length > 0) {
          for (const task of activeTasks) {
            formattedResponse += `- ${task.title}`;
            if (task.due) {
              const dueDate = new Date(task.due);
              formattedResponse += ` (Due: ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
            }
            formattedResponse += "\n";
          }
        } else {
          formattedResponse += "No active tasks.\n";
        }
      } else {
        formattedResponse += "No active tasks.\n";
      }
      
      formattedResponse += "\n## 💡 Recommendations\n\n";
      formattedResponse += "1. Review your upcoming events and prepare any necessary materials\n";
      formattedResponse += "2. Focus on completing high-priority tasks first\n";
      formattedResponse += "3. Consider scheduling time for any overdue tasks\n";
      
      console.log("📝 Summary Agent: Summary created successfully");
      return formattedResponse;
    } catch (error) {
      console.error("📝 Summary Agent error:", error);
      return "Unable to generate summary due to an error.";
    }
  }
}

export class MultiAgentOrchestrator {
  private orchestratorModel: AzureChatOpenAI | null = null;
  private graph: StateGraph<OrchestratorState> | null = null;
  private mcpToolAdapter: MCPToolAdapter;
  private tools: DynamicStructuredTool[] = [];
  private baseModelConfig: any = null;
  
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

      // Store base model configuration for later use
      this.baseModelConfig = {
        azureOpenAIApiKey: apiKey,
        azureOpenAIEndpoint: endpoint,
        azureOpenAIApiDeploymentName: deploymentName,
        azureOpenAIApiVersion: apiVersion,
      };

      console.log("Multi-Agent Orchestrator: Models initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Azure OpenAI:", error);
    }
  }

  private async initializeTools(user?: any) {
    try {
      await this.mcpToolAdapter.initialize(user);
      this.tools = this.mcpToolAdapter.getTools();
      
      if (this.baseModelConfig) {
        // Initialize sub-agents with their specific tools
        const agentModel = new AzureChatOpenAI({
          ...this.baseModelConfig,
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
      
      // For initial summaries, always route to all three agents
      if (state.isInitialSummary) {
        console.log("🎯 Initial summary detected - routing to all agents");
        return {
          routingDecision: {
            agents: ["calendar", "tasks"],
            reasoning: "Initial summary requires both calendar and tasks data"
          }
        };
      }
      
      const routingPrompt = `You are an orchestrator that routes requests to specialized agents.
Available agents:
- calendar: Handles calendar events, scheduling, and time-based queries
- tasks: Handles task lists, to-dos, and task management

Analyze this request and decide which agents to invoke: "${state.userRequest}"

Important: If the request mentions "summary" or needs both calendar AND tasks, include both agents.

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
        
        // Default routing
        return {
          routingDecision: {
            agents: ["calendar", "tasks"],
            reasoning: "Default to both agents for comprehensive response"
          }
        };
      } catch (error) {
        console.error("🎯 Orchestrator error:", error);
        return {
          routingDecision: {
            agents: ["calendar", "tasks"],
            reasoning: "Error in routing, defaulting to both agents"
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
      
      // For initial summaries, always create a formatted summary
      if (state.isInitialSummary && this.summaryAgent) {
        const calendarData = results.calendar || [];
        const tasksData = results.tasks || [];
        
        const summary = await this.summaryAgent.process(
          calendarData,
          tasksData,
          "3 days"
        );
        
        return { finalResponse: summary };
      }
      
      // If we have a summary from the agents, use it
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