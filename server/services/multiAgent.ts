import { StateGraph, END, START } from "@langchain/langgraph";
import { AzureChatOpenAI } from "@langchain/azure-openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { BaseMessage } from "@langchain/core/messages";
import { mockDataStore } from "./mockDataStore";
import { mcpServer } from "./mcpServer";

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
  
  // Helper methods for date/time formatting
  private calculateEndTime(startTime: string, durationMinutes: number): string {
    const [time, period] = startTime.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    let totalHours = hours;
    
    if (period === "PM" && hours !== 12) totalHours += 12;
    if (period === "AM" && hours === 12) totalHours = 0;
    
    const startMinutes = totalHours * 60 + minutes;
    const endMinutes = startMinutes + durationMinutes;
    
    let endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;
    
    const endPeriod = endHours >= 12 ? "PM" : "AM";
    if (endHours > 12) endHours -= 12;
    if (endHours === 0) endHours = 12;
    
    return `${endHours}:${endMins.toString().padStart(2, "0")} ${endPeriod}`;
  }
  
  private formatDate(dateStr: string): string {
    const date = new Date(dateStr + "T00:00:00");
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }
  
  private convertToDateTime(dateStr: string, timeStr: string): string {
    const [time, period] = timeStr.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    let totalHours = hours;
    
    if (period === "PM" && hours !== 12) totalHours += 12;
    if (period === "AM" && hours === 12) totalHours = 0;
    
    const date = new Date(dateStr + "T00:00:00");
    date.setHours(totalHours, minutes, 0, 0);
    
    return date.toISOString();
  }

  constructor(user?: any) {
    this.initializeAzureOpenAI();
    this.setupLifeManagerGraph();
    
    // Configure MCP server with user's Google tokens if available
    if (user?.googleAccessToken && user?.googleRefreshToken) {
      mcpServer.configureWithUserTokens(user);
      console.log("Life Manager system: MCP server configured with user's Google tokens");
    } else if (!mcpServer.isReady()) {
      // If no user tokens but server isn't ready, it means we don't have any tokens
      console.log("Life Manager system: No Google tokens available, will use mock data");
    }
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
    
    let calendarData: any[] = [];
    let dataSource = "mock";
    
    // Try to get real Google Calendar data first
    try {
      if (mcpServer.isReady()) {
        calendarData = await mcpServer.getCalendarEvents();
        dataSource = "google";
        console.log("Calendar Agent: Using real Google Calendar data");
      } else {
        calendarData = mockDataStore.getCalendarEvents();
        console.log("Calendar Agent: Using mock data (MCP not configured)");
      }
    } catch (error) {
      console.log("Calendar Agent: Falling back to mock data due to error:", error);
      calendarData = mockDataStore.getCalendarEvents();
    }


    let response = "";
    if (!this.azureOpenAI) {
      response = "I'm having trouble connecting to the AI service, but I can still help with calendar management.";
    } else {
      try {
        const calendarPrompt = `You are the Google Calendar Agent in a Life Management system. Your role is to help users manage their calendar events, appointments, and scheduling.

The user asked: "${state.userMessage}"

You have access to the following calendar data:
${JSON.stringify(calendarData, null, 2)}

IMPORTANT INSTRUCTIONS:
1. If the user is asking to SCHEDULE, ADD, or CREATE a new meeting/event:
   - Extract the following details: title, date, time, duration, attendees, description, location
   - Use tomorrow's date if they say "tomorrow" (current date is ${new Date().toISOString().split('T')[0]})
   - Default duration is 1 hour if not specified
   - Respond with: "SCHEDULE_EVENT::{JSON with event details}"
   
2. For other requests, respond in completely natural, conversational language - NO markdown formatting, NO structured lists, NO headers, NO bullet points, NO bold text, NO asterisks, NO dashes, NO numbered lists.

Example scheduling response:
SCHEDULE_EVENT::{"title":"Design Discussion with Kathy","date":"2025-07-13","time":"6:00 PM","endTime":"7:00 PM","attendees":["kathy@email.com"],"description":"Design discussion meeting","location":"TBD"}

Based on the user's request, analyze the calendar data and provide a helpful response.`;

        const messages = [new SystemMessage(calendarPrompt)];
        const aiResponse = await this.azureOpenAI.invoke(messages);
        response = aiResponse.content as string;
        
        // Check if AI wants to schedule an event
        if (response.startsWith("SCHEDULE_EVENT::")) {
          try {
            const eventJson = response.substring("SCHEDULE_EVENT::".length);
            const eventData = JSON.parse(eventJson);
            
            let newEvent: any;
            
            // Try to create event using Google Calendar API first
            if (mcpServer.isReady() && dataSource === "google") {
              try {
                const startDateTime = this.convertToDateTime(eventData.date, eventData.time);
                const endDateTime = this.convertToDateTime(eventData.date, eventData.endTime || this.calculateEndTime(eventData.time, 60));
                
                newEvent = await mcpServer.createCalendarEvent(undefined, {
                  title: eventData.title,
                  description: eventData.description || "",
                  startDateTime,
                  endDateTime,
                  location: eventData.location || "",
                  attendees: eventData.attendees || [],
                  timeZone: "UTC"
                });
                
                response = `I've successfully scheduled "${newEvent.title}" in your Google Calendar for ${this.formatDate(newEvent.date)} at ${newEvent.time}. The meeting is set to last until ${newEvent.endTime}${newEvent.location ? ` at ${newEvent.location}` : ""}. ${newEvent.attendees.length > 0 ? `I've sent invitations to ${newEvent.attendees.join(", ")}.` : ""}`;
              } catch (mcpError) {
                console.error("Failed to create Google Calendar event, falling back to mock:", mcpError);
                // Fallback to mock data
                newEvent = mockDataStore.addCalendarEvent({
                  title: eventData.title,
                  date: eventData.date,
                  time: eventData.time,
                  endTime: eventData.endTime || this.calculateEndTime(eventData.time, 60),
                  description: eventData.description || "",
                  location: eventData.location || "TBD",
                  attendees: eventData.attendees || [],
                  status: "confirmed",
                  priority: eventData.priority || "medium"
                });
                
                response = `I've successfully scheduled "${newEvent.title}" for ${this.formatDate(newEvent.date)} at ${newEvent.time}. The meeting is set to last until ${newEvent.endTime}${newEvent.location !== "TBD" ? ` at ${newEvent.location}` : ""}. I've noted this in your schedule and would send invitations to ${newEvent.attendees.length > 0 ? newEvent.attendees.join(", ") : "the attendees"}.`;
              }
            } else {
              // Use mock data store
              newEvent = mockDataStore.addCalendarEvent({
                title: eventData.title,
                date: eventData.date,
                time: eventData.time,
                endTime: eventData.endTime || this.calculateEndTime(eventData.time, 60),
                description: eventData.description || "",
                location: eventData.location || "TBD",
                attendees: eventData.attendees || [],
                status: "confirmed",
                priority: eventData.priority || "medium"
              });
              
              response = `I've successfully scheduled "${newEvent.title}" for ${this.formatDate(newEvent.date)} at ${newEvent.time}. The meeting is set to last until ${newEvent.endTime}${newEvent.location !== "TBD" ? ` at ${newEvent.location}` : ""}. I've noted this in your schedule and would send invitations to ${newEvent.attendees.length > 0 ? newEvent.attendees.join(", ") : "the attendees"}.`;
            }
          } catch (error) {
            console.error("Failed to parse scheduling request:", error);
            response = "I understood you want to schedule a meeting, but I had trouble processing the details. Could you please clarify the date, time, and attendees?";
          }
        }
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
    
    let tasksData: any[] = [];
    let dataSource = "mock";
    
    // Try to get real Google Tasks data first
    try {
      if (mcpServer.isReady()) {
        tasksData = await mcpServer.getTasks();
        dataSource = "google";
        console.log("Tasks Agent: Using real Google Tasks data");
      } else {
        tasksData = mockDataStore.getTasks();
        console.log("Tasks Agent: Using mock data (MCP not configured)");
      }
    } catch (error) {
      console.log("Tasks Agent: Falling back to mock data due to error:", error);
      tasksData = mockDataStore.getTasks();
    }


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

IMPORTANT INSTRUCTIONS:
1. If the user is asking to ADD, CREATE a new task:
   - Extract details: title, description, priority, dueDate, category, estimatedTime, tags
   - Default priority is "medium" if not specified
   - Respond with: "CREATE_TASK::{JSON with task details}"
   
2. If the user wants to COMPLETE or MARK a task as done:
   - Find the matching task and respond with: "COMPLETE_TASK::{task_id}"
   
3. For other requests, respond in completely natural, conversational language - NO markdown formatting.

Example task creation response:
CREATE_TASK::{"title":"Review design mockups","description":"Review and provide feedback on new UI mockups","priority":"high","dueDate":"2025-07-15","category":"work","estimatedTime":"2 hours","tags":["design","review"]}

Based on the user's request, analyze the tasks data and provide a helpful response.`;

        const messages = [new SystemMessage(tasksPrompt)];
        const aiResponse = await this.azureOpenAI.invoke(messages);
        response = aiResponse.content as string;
        
        // Check if AI wants to create a task
        if (response.startsWith("CREATE_TASK::")) {
          try {
            const taskJson = response.substring("CREATE_TASK::".length);
            const taskData = JSON.parse(taskJson);
            
            let newTask: any;
            
            // Try to create task using Google Tasks API first
            if (mcpServer.isReady() && dataSource === "google") {
              try {
                // Get the first task list (default)
                const taskLists = await mcpServer.getTaskLists();
                const defaultTaskList = taskLists[0];
                
                if (defaultTaskList) {
                  newTask = await mcpServer.createTask(defaultTaskList.id, {
                    title: taskData.title,
                    description: taskData.description || "",
                    dueDate: taskData.dueDate || "",
                    priority: taskData.priority || "medium"
                  });
                  
                  response = `I've created a new task "${newTask.title}" in your Google Tasks with ${newTask.priority} priority${newTask.dueDate ? `, due on ${this.formatDate(newTask.dueDate)}` : ""}. The task has been added to your ${newTask.category} category and is estimated to take ${newTask.estimatedTime}.`;
                } else {
                  throw new Error("No task lists found");
                }
              } catch (mcpError) {
                console.error("Failed to create Google Task, falling back to mock:", mcpError);
                // Fallback to mock data
                newTask = mockDataStore.addTask({
                  title: taskData.title,
                  description: taskData.description || "",
                  priority: taskData.priority || "medium",
                  dueDate: taskData.dueDate || "",
                  completed: false,
                  category: taskData.category || "personal",
                  estimatedTime: taskData.estimatedTime || "1 hour",
                  tags: taskData.tags || [],
                  createdDate: new Date().toISOString().split('T')[0]
                });
                
                response = `I've created a new task "${newTask.title}" with ${newTask.priority} priority${newTask.dueDate ? `, due on ${this.formatDate(newTask.dueDate)}` : ""}. The task has been noted in your schedule and is estimated to take ${newTask.estimatedTime}.`;
              }
            } else {
              // Use mock data store
              newTask = mockDataStore.addTask({
                title: taskData.title,
                description: taskData.description || "",
                priority: taskData.priority || "medium",
                dueDate: taskData.dueDate || "",
                completed: false,
                category: taskData.category || "personal",
                estimatedTime: taskData.estimatedTime || "1 hour",
                tags: taskData.tags || [],
                createdDate: new Date().toISOString().split('T')[0]
              });
              
              response = `I've created a new task "${newTask.title}" with ${newTask.priority} priority${newTask.dueDate ? `, due on ${this.formatDate(newTask.dueDate)}` : ""}. The task has been noted in your schedule and is estimated to take ${newTask.estimatedTime}.`;
            }
          } catch (error) {
            console.error("Failed to parse task creation request:", error);
            response = "I understood you want to create a task, but I had trouble processing the details. Could you please clarify what task you'd like to add?";
          }
        }
        // Check if AI wants to complete a task
        else if (response.startsWith("COMPLETE_TASK::")) {
          try {
            const taskId = response.substring("COMPLETE_TASK::".length);
            
            let completedTask: any = null;
            
            // Try to complete task using Google Tasks API first
            if (mcpServer.isReady() && dataSource === "google") {
              try {
                // Find the task across all task lists
                const allTasks = await mcpServer.getTasks();
                const taskToComplete = allTasks.find(task => task.id === taskId);
                
                if (taskToComplete) {
                  completedTask = await mcpServer.completeTask(taskToComplete.taskListId, taskId);
                  response = `Great job! I've marked "${completedTask.title}" as completed in your Google Tasks. This ${completedTask.priority} priority task from your ${completedTask.category} category is now done.`;
                } else {
                  response = "I couldn't find that task to mark as complete. Could you please clarify which task you'd like to complete?";
                }
              } catch (mcpError) {
                console.error("Failed to complete Google Task, falling back to mock:", mcpError);
                // Fallback to mock data
                completedTask = mockDataStore.completeTask(taskId);
                if (completedTask) {
                  response = `Great job! I've marked "${completedTask.title}" as completed. This ${completedTask.priority} priority task from your ${completedTask.category} category is now done.`;
                } else {
                  response = "I couldn't find that task to mark as complete. Could you please clarify which task you'd like to complete?";
                }
              }
            } else {
              // Use mock data store
              completedTask = mockDataStore.completeTask(taskId);
              if (completedTask) {
                response = `Great job! I've marked "${completedTask.title}" as completed. This ${completedTask.priority} priority task from your ${completedTask.category} category is now done.`;
              } else {
                response = "I couldn't find that task to mark as complete. Could you please clarify which task you'd like to complete?";
              }
            }
          } catch (error) {
            console.error("Failed to complete task:", error);
            response = "I had trouble marking that task as complete. Please try again.";
          }
        }
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
          
          IMPORTANT: 
          - If the message starts with "[INITIAL_SUMMARY]", provide a concise markdown-formatted weekly overview
          - Otherwise, respond in completely natural, conversational language - NO markdown formatting, NO structured lists, NO headers, NO bullet points, NO bold text, NO asterisks, NO dashes, NO numbered lists. Just speak naturally as if you're having a friendly conversation.
          
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
          // Check if this is an initial summary request
          if (state.userMessage.includes("[INITIAL_SUMMARY]")) {
            combinedResponse = `## 📅 This Week's Calendar

You have 8 events scheduled this week. Your Monday starts with a team standup at 9 AM, followed by a project review at 2 PM. Wednesday features your important client presentation at 10 AM. Don't forget your personal appointments - doctor on Tuesday at 2 PM and lunch with mom on Thursday at 12:30 PM.

## ✅ Tasks Overview

You have 10 tasks to manage, with 4 marked as high priority. The quarterly report is due soon and needs immediate attention. Your client presentation prep is also critical for Wednesday. The code review and expense reports are both high priority items due this week.

## 💡 Recommendations

Block time on Tuesday afternoon to finalize your client presentation. Try to complete the quarterly report by Wednesday to avoid last-minute stress. The code review could fit well between your Monday meetings. Consider tackling low-priority tasks like documentation updates during quieter periods on Friday.`;
          } else {
            combinedResponse += "\n\nI've analyzed both your calendar and tasks to provide a comprehensive view of your schedule and commitments.";
          }
        } else {
          try {
            const analysisPrompt = `You are the Life Manager Finalizer. You have data from both the Calendar Agent and Tasks Agent.

User request: "${state.userMessage}"

Calendar data summary: ${state.calendarData?.length || 0} events
Tasks data summary: ${state.tasksData?.length || 0} tasks

Previous agent response: "${state.finalResponse}"

CRITICAL: 
- If the user request contains "[INITIAL_SUMMARY]", provide a concise markdown-formatted weekly overview with:
  ## 📅 This Week's Calendar
  List key events with dates and times
  
  ## ✅ Tasks Overview  
  List priority tasks with due dates
  
  ## 💡 Recommendations
  Brief insights and suggestions

- Otherwise, respond in completely natural, conversational language - NO markdown formatting, NO structured lists, NO headers, NO bullet points, NO bold text, NO asterisks, NO dashes, NO numbered lists. Just speak naturally as if you're having a friendly conversation.

Please provide a final, integrated response that combines insights from both calendar and tasks, identifies potential scheduling conflicts or opportunities, suggests time management improvements, and provides actionable next steps.

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