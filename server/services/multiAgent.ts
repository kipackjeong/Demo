import { StateGraph, END, START } from "@langchain/langgraph";
import { AzureChatOpenAI } from "@langchain/azure-openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { BaseMessage } from "@langchain/core/messages";

// Define the state interface for the life management system
interface LifeManagerState {
  messages: BaseMessage[];
  userMessage: string;
  sessionId: string;
  agentDecision: string;
  finalResponse: string;
  context: Record<string, any>;
  calendarData?: any[];
  tasksData?: any[];
  orchestrationPlan?: string;
}

export class LifeManagerSystem {
  private azureOpenAI: AzureChatOpenAI | null = null;
  private conversationHistory: Map<string, Array<{ role: string; content: string }>> = new Map();
  private graph: StateGraph<LifeManagerState> | null = null;

  constructor() {
    this.initializeAzureOpenAI();
    this.setupLifeManagerGraph();
  }

  private initializeAzureOpenAI() {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME?.trim();
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-01";

    if (!endpoint || !deploymentName) {
      console.log("Life Manager system: Azure OpenAI configuration incomplete");
      return;
    }

    try {
      if (apiKey) {
        this.azureOpenAI = new AzureChatOpenAI({
          azureOpenAIApiKey: apiKey,
          azureOpenAIEndpoint: endpoint,
          azureOpenAIApiDeploymentName: deploymentName,
          azureOpenAIApiVersion: apiVersion,
          temperature: 0.7,
          maxTokens: 1000,
          timeout: 10000,
        });
        console.log("Life Manager system: Azure OpenAI initialized successfully");
      }
    } catch (error) {
      console.error("Life Manager system: Failed to initialize Azure OpenAI:", error);
    }
  }

  private setupLifeManagerGraph() {
    // Create the state graph for life management
    const workflow = new StateGraph<LifeManagerState>({
      channels: {
        messages: {
          reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
          default: () => [],
        },
        userMessage: {
          default: () => "",
        },
        sessionId: {
          default: () => "",
        },
        agentDecision: {
          default: () => "",
        },
        finalResponse: {
          default: () => "",
        },
        context: {
          default: () => ({}),
        },
        calendarData: {
          default: () => [],
        },
        tasksData: {
          default: () => [],
        },
        orchestrationPlan: {
          default: () => "",
        },
      },
    });

    // Add nodes to the graph
    workflow.addNode("orchestration_agent", this.orchestrationAgent.bind(this));
    workflow.addNode("calendar_agent", this.calendarAgent.bind(this));
    workflow.addNode("tasks_agent", this.tasksAgent.bind(this));
    workflow.addNode("life_manager_finalizer", this.lifeManagerFinalizer.bind(this));

    // Define the workflow edges
    workflow.addEdge(START, "orchestration_agent");
    
    // Conditional edges from orchestration agent to specialized agents
    workflow.addConditionalEdges(
      "orchestration_agent",
      this.routeToLifeAgent.bind(this),
      {
        "calendar": "calendar_agent",
        "tasks": "tasks_agent",
        "both": "calendar_agent", // Start with calendar, then tasks
        "direct_response": "life_manager_finalizer",
      }
    );

    // Calendar agent can flow to tasks agent or finalizer
    workflow.addConditionalEdges(
      "calendar_agent",
      this.shouldProcessTasks.bind(this),
      {
        "tasks": "tasks_agent",
        "finalizer": "life_manager_finalizer",
      }
    );

    // Tasks agent flows to finalizer
    workflow.addEdge("tasks_agent", "life_manager_finalizer");
    workflow.addEdge("life_manager_finalizer", END);

    this.graph = workflow.compile();
    console.log("Life Manager system: Graph compiled successfully");
  }

  // Orchestration (Boss) Agent decides which specialized agent is needed
  private async orchestrationAgent(state: LifeManagerState): Promise<Partial<LifeManagerState>> {
    if (!this.azureOpenAI) {
      return { 
        agentDecision: "direct_response",
        orchestrationPlan: "AI service unavailable"
      };
    }

    try {
      const orchestrationPrompt = `You are the Orchestration Agent for a Life Management system. Your role is to analyze user requests and determine which specialized agents should handle the task.

Available agents:
- "calendar": Google Calendar Agent - handles scheduling, appointments, calendar events, meeting management
- "tasks": Google Tasks Agent - handles todo lists, task management, reminders, project tracking
- "both": Both agents needed - for complex requests involving both calendar and tasks
- "direct_response": Handle directly - for general questions about life management, system help, or casual conversation

Analyze this user message and decide which agent(s) should handle it:
"${state.userMessage}"

Consider:
- Does it involve scheduling, appointments, or calendar events? → calendar
- Does it involve tasks, todos, or reminders? → tasks  
- Does it need both calendar and task data? → both
- Is it a general question or greeting? → direct_response

Respond with ONLY the agent decision (calendar, tasks, both, or direct_response).`;

      const messages = [new SystemMessage(orchestrationPrompt)];
      const response = await this.azureOpenAI.invoke(messages);
      const decision = (response.content as string).trim().toLowerCase();

      console.log(`Orchestration decision: ${decision} for message: "${state.userMessage}"`);
      
      const validDecisions = ["calendar", "tasks", "both", "direct_response"];
      const finalDecision = validDecisions.includes(decision) ? decision : "direct_response";
      
      return { 
        agentDecision: finalDecision,
        orchestrationPlan: `Routing to ${finalDecision} agent(s)`,
        context: { orchestrationReason: decision }
      };
    } catch (error) {
      console.error("Orchestration agent error:", error);
      return { 
        agentDecision: "direct_response",
        orchestrationPlan: "Error in orchestration, handling directly"
      };
    }
  }

  // Route to the appropriate agent based on orchestration decision
  private routeToLifeAgent(state: LifeManagerState): string {
    return state.agentDecision || "direct_response";
  }

  // Determine if tasks agent should also be called after calendar agent
  private shouldProcessTasks(state: LifeManagerState): string {
    return state.agentDecision === "both" ? "tasks" : "finalizer";
  }

  // Google Calendar Agent - handles calendar-related requests
  private async calendarAgent(state: LifeManagerState): Promise<Partial<LifeManagerState>> {
    console.log("Calendar Agent processing request:", state.userMessage);
    
    // TODO: Implement Google Calendar API integration
    // For now, return a placeholder response indicating calendar functionality
    const calendarData = [
      {
        title: "Meeting with Team",
        date: "2025-07-12",
        time: "10:00 AM",
        description: "Weekly team standup meeting"
      },
      {
        title: "Doctor Appointment",
        date: "2025-07-13",
        time: "2:00 PM",
        description: "Annual checkup"
      }
    ];

    let response = "";
    if (!this.azureOpenAI) {
      response = "I'm having trouble connecting to the AI service, but I can still help with calendar management.";
    } else {
      try {
        const calendarPrompt = `You are the Google Calendar Agent in a Life Management system. Your role is to help users manage their calendar events, appointments, and scheduling.

The user asked: "${state.userMessage}"

Based on the user's request, I would normally:
1. Connect to Google Calendar API to retrieve/modify calendar data
2. Parse the user's intent (view schedule, add event, reschedule, etc.)
3. Perform the requested calendar operation

Current calendar data (placeholder):
${JSON.stringify(calendarData, null, 2)}

Please provide a helpful response about calendar management. Note that Google Calendar API integration is not yet implemented, so explain what would be done when the integration is complete.`;

        const messages = [new SystemMessage(calendarPrompt)];
        const aiResponse = await this.azureOpenAI.invoke(messages);
        response = aiResponse.content as string;
      } catch (error) {
        console.error("Calendar agent error:", error);
        response = "I'm having trouble processing your calendar request right now. Please try again later.";
      }
    }

    return { 
      calendarData,
      finalResponse: response,
      context: { ...state.context, calendarProcessed: true }
    };
  }

  // Google Tasks Agent - handles task-related requests
  private async tasksAgent(state: LifeManagerState): Promise<Partial<LifeManagerState>> {
    console.log("Tasks Agent processing request:", state.userMessage);
    
    // TODO: Implement Google Tasks API integration
    // For now, return a placeholder response indicating tasks functionality
    const tasksData = [
      {
        title: "Complete project proposal",
        priority: "high",
        dueDate: "2025-07-15",
        completed: false
      },
      {
        title: "Buy groceries",
        priority: "medium",
        dueDate: "2025-07-12",
        completed: false
      },
      {
        title: "Call dentist",
        priority: "low",
        dueDate: null,
        completed: true
      }
    ];

    let response = "";
    if (!this.azureOpenAI) {
      response = "I'm having trouble connecting to the AI service, but I can still help with task management.";
    } else {
      try {
        const tasksPrompt = `You are the Google Tasks Agent in a Life Management system. Your role is to help users manage their tasks, todos, and reminders.

The user asked: "${state.userMessage}"

Based on the user's request, I would normally:
1. Connect to Google Tasks API to retrieve/modify task data
2. Parse the user's intent (view tasks, add task, mark complete, etc.)
3. Perform the requested task operation

Current tasks data (placeholder):
${JSON.stringify(tasksData, null, 2)}

Calendar context from previous agent: ${state.context?.calendarProcessed ? "Calendar data was processed" : "No calendar data processed"}

Please provide a helpful response about task management. Note that Google Tasks API integration is not yet implemented, so explain what would be done when the integration is complete.`;

        const messages = [new SystemMessage(tasksPrompt)];
        const aiResponse = await this.azureOpenAI.invoke(messages);
        response = aiResponse.content as string;
      } catch (error) {
        console.error("Tasks agent error:", error);
        response = "I'm having trouble processing your task request right now. Please try again later.";
      }
    }

    return { 
      tasksData,
      finalResponse: response,
      context: { ...state.context, tasksProcessed: true }
    };
  }

  // Life Manager Finalizer - combines results and provides final response
  private async lifeManagerFinalizer(state: LifeManagerState): Promise<Partial<LifeManagerState>> {
    // If we have a direct response, use it
    if (state.agentDecision === "direct_response") {
      if (!this.azureOpenAI) {
        return { finalResponse: "Hello! I'm your Life Manager assistant. I can help you manage your calendar events and tasks. How can I assist you today?" };
      }

      try {
        const history = this.conversationHistory.get(state.sessionId) || [];
        
        const messages = [
          new SystemMessage(`You are a Life Manager assistant that helps users manage their schedules and tasks. 
          You are friendly, organized, and proactive about helping users stay on top of their commitments.
          
          If the user is asking general questions about life management, provide helpful tips and guidance.
          If they're greeting you, be warm and explain how you can help with calendar and task management.`),
          ...history.slice(-6).map(msg => 
            msg.role === "user" ? new HumanMessage(msg.content) : new AIMessage(msg.content)
          ),
          new HumanMessage(state.userMessage)
        ];

        const response = await this.azureOpenAI.invoke(messages);
        const content = response.content as string;

        // Update conversation history
        history.push({ role: "user", content: state.userMessage });
        history.push({ role: "assistant", content: content });
        this.conversationHistory.set(state.sessionId, history.slice(-20));

        return { finalResponse: content };
      } catch (error) {
        console.error("Life Manager finalizer error:", error);
        return { finalResponse: "I'm having trouble processing your request right now. Please try again." };
      }
    }

    // If we have agent responses, combine them
    const hasCalendarData = state.calendarData && state.calendarData.length > 0;
    const hasTasksData = state.tasksData && state.tasksData.length > 0;

    if (hasCalendarData || hasTasksData) {
      let combinedResponse = state.finalResponse || "Here's what I found:";
      
      if (hasCalendarData && hasTasksData) {
        combinedResponse += "\n\nI've processed both your calendar and tasks data to give you a comprehensive view of your schedule and commitments.";
      }
      
      return { finalResponse: combinedResponse };
    }

    // Return the existing response
    return { finalResponse: state.finalResponse || "I'm ready to help you manage your life better!" };
  }

  // Main method to generate response using the life management system
  async generateResponse(userMessage: string, sessionId: string = "default"): Promise<string> {
    if (!this.graph) {
      console.log("Life Manager system not initialized, falling back to simple response");
      return "I'm currently setting up the Life Manager system. Please try again in a moment.";
    }

    try {
      console.log(`Life Manager system processing: "${userMessage}" for session: ${sessionId}`);
      
      const initialState: LifeManagerState = {
        messages: [],
        userMessage,
        sessionId,
        agentDecision: "",
        finalResponse: "",
        context: {},
        calendarData: [],
        tasksData: [],
        orchestrationPlan: "",
      };

      const result = await this.graph.invoke(initialState);
      
      console.log(`Life Manager system completed with decision: ${result.agentDecision}`);
      console.log(`Orchestration plan: ${result.orchestrationPlan}`);
      
      return result.finalResponse || "I'm having trouble generating a response right now.";
    } catch (error) {
      console.error("Life Manager system error:", error);
      return "I encountered an error while processing your request. Please try again.";
    }
  }

  // Clear conversation history for a session
  clearConversationHistory(sessionId: string) {
    this.conversationHistory.delete(sessionId);
  }

  // Get system status
  getSystemStatus(): Record<string, any> {
    return {
      azureOpenAIInitialized: !!this.azureOpenAI,
      graphInitialized: !!this.graph,
      activeSessions: this.conversationHistory.size,
      agents: {
        orchestration: "Active",
        googleCalendar: "Placeholder (API not integrated)",
        googleTasks: "Placeholder (API not integrated)",
      },
    };
  }
}