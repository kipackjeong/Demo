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
    
    // Rich mock calendar data for testing
    const calendarData = [
      {
        id: "cal_001",
        title: "Team Sprint Planning",
        date: "2025-07-12",
        time: "09:00 AM",
        endTime: "11:00 AM",
        description: "Planning session for Q3 sprint goals and backlog prioritization",
        location: "Conference Room A",
        attendees: ["john@company.com", "sarah@company.com", "mike@company.com"],
        status: "confirmed",
        priority: "high"
      },
      {
        id: "cal_002",
        title: "Doctor Appointment - Annual Checkup",
        date: "2025-07-13",
        time: "2:00 PM",
        endTime: "3:00 PM",
        description: "Annual physical examination with Dr. Smith",
        location: "Medical Center, Suite 204",
        attendees: ["patient@email.com"],
        status: "confirmed",
        priority: "medium"
      },
      {
        id: "cal_003",
        title: "Client Presentation - Q3 Review",
        date: "2025-07-14",
        time: "3:30 PM",
        endTime: "5:00 PM",
        description: "Quarterly business review with ABC Corp client",
        location: "Virtual Meeting (Zoom)",
        attendees: ["client@abccorp.com", "account@company.com"],
        status: "confirmed",
        priority: "high"
      },
      {
        id: "cal_004",
        title: "Lunch with Mom",
        date: "2025-07-15",
        time: "12:30 PM",
        endTime: "2:00 PM",
        description: "Monthly lunch catch-up",
        location: "Italian Bistro downtown",
        attendees: ["mom@family.com"],
        status: "confirmed",
        priority: "medium"
      },
      {
        id: "cal_005",
        title: "Dentist Appointment",
        date: "2025-07-16",
        time: "10:00 AM",
        endTime: "11:00 AM",
        description: "Routine dental cleaning",
        location: "Smile Dental Clinic",
        attendees: ["patient@email.com"],
        status: "confirmed",
        priority: "low"
      },
      {
        id: "cal_006",
        title: "Project Demo - Marketing Team",
        date: "2025-07-17",
        time: "4:00 PM",
        endTime: "5:30 PM",
        description: "Demo new analytics dashboard features",
        location: "Meeting Room B",
        attendees: ["marketing@company.com", "dev@company.com"],
        status: "tentative",
        priority: "medium"
      },
      {
        id: "cal_007",
        title: "Weekend Hiking Trip",
        date: "2025-07-19",
        time: "8:00 AM",
        endTime: "6:00 PM",
        description: "Day hike at Blue Ridge Mountains with friends",
        location: "Blue Ridge Trail Head",
        attendees: ["friends@group.com"],
        status: "confirmed",
        priority: "low"
      },
      {
        id: "cal_008",
        title: "1:1 with Manager",
        date: "2025-07-21",
        time: "2:00 PM",
        endTime: "3:00 PM",
        description: "Monthly check-in and performance review",
        location: "Manager's Office",
        attendees: ["manager@company.com"],
        status: "confirmed",
        priority: "high"
      }
    ];

    let response = "";
    if (!this.azureOpenAI) {
      response = "I'm having trouble connecting to the AI service, but I can still help with calendar management.";
    } else {
      try {
        const calendarPrompt = `You are the Google Calendar Agent in a Life Management system. Your role is to help users manage their calendar events, appointments, and scheduling.

The user asked: "${state.userMessage}"

You have access to the following calendar data:
${JSON.stringify(calendarData, null, 2)}

Based on the user's request, analyze the calendar data and provide a helpful response. You can:
1. Show upcoming events and appointments
2. Identify scheduling conflicts
3. Suggest optimal meeting times
4. Provide calendar summaries and insights
5. Help with event planning and scheduling

Please provide a comprehensive response using the actual calendar data. Be specific about dates, times, and event details. Format your response in a clear, organized manner.`;

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
    
    // Rich mock tasks data for testing
    const tasksData = [
      {
        id: "task_001",
        title: "Complete Q3 Project Proposal",
        description: "Finalize the project proposal document for Q3 initiatives including budget analysis and timeline",
        priority: "high",
        dueDate: "2025-07-15",
        completed: false,
        category: "work",
        estimatedTime: "4 hours",
        tags: ["project", "proposal", "Q3"],
        createdDate: "2025-07-01"
      },
      {
        id: "task_002",
        title: "Buy Groceries for Week",
        description: "Weekly grocery shopping: milk, bread, eggs, vegetables, fruits, chicken",
        priority: "medium",
        dueDate: "2025-07-12",
        completed: false,
        category: "personal",
        estimatedTime: "1.5 hours",
        tags: ["shopping", "food", "weekly"],
        createdDate: "2025-07-10"
      },
      {
        id: "task_003",
        title: "Schedule Annual Physical Exam",
        description: "Call Dr. Smith's office to schedule annual physical examination",
        priority: "low",
        dueDate: "2025-07-20",
        completed: true,
        category: "health",
        estimatedTime: "15 minutes",
        tags: ["health", "appointment", "annual"],
        createdDate: "2025-07-05",
        completedDate: "2025-07-11"
      },
      {
        id: "task_004",
        title: "Prepare Marketing Dashboard Demo",
        description: "Create slides and demo script for marketing team presentation",
        priority: "high",
        dueDate: "2025-07-17",
        completed: false,
        category: "work",
        estimatedTime: "3 hours",
        tags: ["presentation", "marketing", "demo"],
        createdDate: "2025-07-08"
      },
      {
        id: "task_005",
        title: "Research Weekend Hiking Gear",
        description: "Look up best hiking boots and backpack for Blue Ridge trip",
        priority: "low",
        dueDate: "2025-07-18",
        completed: false,
        category: "personal",
        estimatedTime: "1 hour",
        tags: ["hiking", "gear", "research"],
        createdDate: "2025-07-09"
      },
      {
        id: "task_006",
        title: "Update Resume with Recent Projects",
        description: "Add Q2 accomplishments and recent project outcomes to resume",
        priority: "medium",
        dueDate: "2025-07-25",
        completed: false,
        category: "career",
        estimatedTime: "2 hours",
        tags: ["resume", "career", "projects"],
        createdDate: "2025-07-03"
      },
      {
        id: "task_007",
        title: "Plan Mom's Birthday Celebration",
        description: "Organize dinner reservation and gift for mom's birthday next month",
        priority: "medium",
        dueDate: "2025-07-30",
        completed: false,
        category: "personal",
        estimatedTime: "2 hours",
        tags: ["birthday", "family", "planning"],
        createdDate: "2025-07-06"
      },
      {
        id: "task_008",
        title: "Submit Expense Reports",
        description: "Process and submit Q2 business expense reports to accounting",
        priority: "high",
        dueDate: "2025-07-14",
        completed: false,
        category: "work",
        estimatedTime: "1 hour",
        tags: ["expenses", "reports", "accounting"],
        createdDate: "2025-07-07"
      },
      {
        id: "task_009",
        title: "Clean and Organize Home Office",
        description: "Deep clean desk area and organize filing system",
        priority: "low",
        dueDate: null,
        completed: false,
        category: "personal",
        estimatedTime: "3 hours",
        tags: ["cleaning", "organization", "office"],
        createdDate: "2025-07-02"
      },
      {
        id: "task_010",
        title: "Review and Sign Insurance Documents",
        description: "Review updated health insurance policy and sign renewal forms",
        priority: "medium",
        dueDate: "2025-07-22",
        completed: false,
        category: "admin",
        estimatedTime: "45 minutes",
        tags: ["insurance", "documents", "renewal"],
        createdDate: "2025-07-04"
      }
    ];

    let response = "";
    if (!this.azureOpenAI) {
      response = "I'm having trouble connecting to the AI service, but I can still help with task management.";
    } else {
      try {
        const tasksPrompt = `You are the Google Tasks Agent in a Life Management system. Your role is to help users manage their tasks, todos, and reminders.

The user asked: "${state.userMessage}"

You have access to the following tasks data:
${JSON.stringify(tasksData, null, 2)}

Calendar context from previous agent: ${state.context?.calendarProcessed ? "Calendar data was processed" : "No calendar data processed"}

Based on the user's request, analyze the tasks data and provide a helpful response. You can:
1. Show pending tasks and their priorities
2. Identify overdue tasks and urgent deadlines
3. Suggest task prioritization and time management
4. Provide task summaries by category or priority
5. Help with task planning and scheduling
6. Show completed tasks and progress tracking

Please provide a comprehensive response using the actual tasks data. Be specific about task details, due dates, and priorities. Format your response in a clear, organized manner with actionable insights.`;

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

    // If we have agent responses, combine them intelligently
    const hasCalendarData = state.calendarData && state.calendarData.length > 0;
    const hasTasksData = state.tasksData && state.tasksData.length > 0;

    if (hasCalendarData || hasTasksData) {
      let combinedResponse = state.finalResponse || "Here's your life management overview:";
      
      if (hasCalendarData && hasTasksData) {
        // Provide intelligent cross-analysis when both calendar and tasks are processed
        if (!this.azureOpenAI) {
          combinedResponse += "\n\nI've analyzed both your calendar and tasks to provide a comprehensive view of your schedule and commitments.";
        } else {
          try {
            const analysisPrompt = `You are the Life Manager Finalizer. You have data from both the Calendar Agent and Tasks Agent.

User request: "${state.userMessage}"

Calendar data summary: ${state.calendarData?.length || 0} events
Tasks data summary: ${state.tasksData?.length || 0} tasks

Previous agent response: "${state.finalResponse}"

Please provide a final, integrated response that:
1. Combines insights from both calendar and tasks
2. Identifies potential scheduling conflicts or opportunities
3. Suggests time management improvements
4. Provides actionable next steps

Keep the response comprehensive but concise.`;

            const messages = [new SystemMessage(analysisPrompt)];
            const response = await this.azureOpenAI.invoke(messages);
            combinedResponse = response.content as string;
          } catch (error) {
            console.error("Combined analysis error:", error);
            combinedResponse += "\n\nI've processed both your calendar and tasks data to give you a comprehensive view of your schedule and commitments.";
          }
        }
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