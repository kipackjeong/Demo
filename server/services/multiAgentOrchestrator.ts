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
  private userLanguage: string = 'en';

  constructor(model: AzureChatOpenAI) {
    this.model = model;
  }

  // Simple language detection based on character patterns
  private detectLanguage(text: string): string {
    // Korean characters
    if (/[\u3131-\uD79D]/.test(text)) return 'ko';
    // Japanese characters (Hiragana, Katakana, Kanji)
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return 'ja';
    // Chinese characters (simplified/traditional)
    if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
    // Default to English
    return 'en';
  }

  setUserLanguage(userMessage: string) {
    this.userLanguage = this.detectLanguage(userMessage);
    console.log(`📝 Summary Agent: Detected language: ${this.userLanguage}`);
  }

  async process(calendarData: any[], tasksData: any[], timeRange: string = "3 days"): Promise<string> {
    console.log("📝 SUMMARY AGENT: Creating summary");
    console.log(`Processing ${calendarData.length} calendar events and ${tasksData.length} tasks`);
    
    try {
      // Format the summary based on detected language
      let formattedResponse = '';
      
      // Language-specific headers and content
      // If showing all tasks without calendar events, skip the calendar header
      const isTasksOnly = timeRange === 'all' && (!calendarEvents || calendarEvents.length === 0);
      
      if (!isTasksOnly) {
        if (this.userLanguage === 'ko') {
          const rangeText = timeRange === '3 days' ? '3일간의' : 
                           timeRange === 'week' ? '이번 주' :
                           timeRange === 'today' ? '오늘의' :
                           timeRange === 'tomorrow' ? '내일의' :
                           timeRange === 'month' ? '이번 달' : 
                           timeRange === 'all' ? '전체' : timeRange;
          formattedResponse = `## 📅 ${rangeText} 일정\n\n`;
        } else if (this.userLanguage === 'ja') {
          const rangeText = timeRange === '3 days' ? '3日間' :
                           timeRange === 'week' ? '今週' :
                           timeRange === 'today' ? '今日' :
                           timeRange === 'tomorrow' ? '明日' :
                           timeRange === 'month' ? '今月' :
                           timeRange === 'all' ? '全体' : timeRange;
          formattedResponse = `## 📅 ${rangeText}の予定\n\n`;
        } else if (this.userLanguage === 'zh') {
          const rangeText = timeRange === '3 days' ? '3天' :
                           timeRange === 'week' ? '本周' :
                           timeRange === 'today' ? '今天' :
                           timeRange === 'tomorrow' ? '明天' :
                           timeRange === 'month' ? '本月' :
                           timeRange === 'all' ? '全部' : timeRange;
          formattedResponse = `## 📅 ${rangeText}的日程\n\n`;
        } else {
          const rangeText = timeRange === '3 days' ? 'Next 3 days' :
                           timeRange === 'week' ? 'This week' :
                           timeRange === 'today' ? 'Today' :
                           timeRange === 'tomorrow' ? 'Tomorrow' :
                           timeRange === 'month' ? 'This month' :
                           timeRange === 'all' ? 'All' : timeRange;
          formattedResponse = `## 📅 ${rangeText}\n\n`;
        }
      }
      
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
          const locale = this.userLanguage === 'ko' ? 'ko-KR' : 
                        this.userLanguage === 'ja' ? 'ja-JP' :
                        this.userLanguage === 'zh' ? 'zh-CN' : 'en-US';
                        
          if (!isNaN(startDate.getTime())) {
            const dateStr = startDate.toLocaleDateString(locale, { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            });
            const timeStr = startDate.toLocaleTimeString(locale, { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
            dateTimeStr = `${dateStr}, ${timeStr}`;
          } else if (event.date && event.time) {
            // Handle separate date and time fields from mock data
            dateTimeStr = `${event.date}, ${event.time}`;
          } else {
            dateTimeStr = this.userLanguage === 'ko' ? '날짜 미정' :
                         this.userLanguage === 'ja' ? '日付未定' :
                         this.userLanguage === 'zh' ? '日期待定' : 'Date TBD';
          }
          
          const untitledText = this.userLanguage === 'ko' ? '제목 없음' :
                              this.userLanguage === 'ja' ? 'タイトルなし' :
                              this.userLanguage === 'zh' ? '无标题' : 'Untitled Event';
          
          formattedResponse += `- **${event.title || event.summary || untitledText}** - ${dateTimeStr}\n`;
          if (event.location) {
            const locationLabel = this.userLanguage === 'ko' ? '장소' :
                                 this.userLanguage === 'ja' ? '場所' :
                                 this.userLanguage === 'zh' ? '地点' : 'Location';
            formattedResponse += `  ${locationLabel}: ${event.location}\n`;
          }
          if (event.description) {
            formattedResponse += `  ${event.description}\n`;
          }
          formattedResponse += "\n";
        }
      } else {
        const noEventsText = this.userLanguage === 'ko' ? 
                           (timeRange === 'week' ? '이번 주 예정된 일정이 없습니다.' :
                            timeRange === 'today' ? '오늘 예정된 일정이 없습니다.' :
                            timeRange === 'tomorrow' ? '내일 예정된 일정이 없습니다.' :
                            timeRange === 'month' ? '이번 달 예정된 일정이 없습니다.' :
                            `${timeRange} 예정된 일정이 없습니다.`) :
                           this.userLanguage === 'ja' ? 
                           (timeRange === 'week' ? '今週の予定はありません。' :
                            timeRange === 'today' ? '今日の予定はありません。' :
                            timeRange === 'tomorrow' ? '明日の予定はありません。' :
                            timeRange === 'month' ? '今月の予定はありません。' :
                            `${timeRange}の予定はありません。`) :
                           this.userLanguage === 'zh' ? 
                           (timeRange === 'week' ? '本周没有安排的日程。' :
                            timeRange === 'today' ? '今天没有安排的日程。' :
                            timeRange === 'tomorrow' ? '明天没有安排的日程。' :
                            timeRange === 'month' ? '本月没有安排的日程。' :
                            `${timeRange}没有安排的日程。`) :
                           (timeRange === 'week' ? 'No events scheduled this week.' :
                            timeRange === 'today' ? 'No events scheduled today.' :
                            timeRange === 'tomorrow' ? 'No events scheduled tomorrow.' :
                            timeRange === 'month' ? 'No events scheduled this month.' :
                            `No events scheduled for ${timeRange}.`);
        formattedResponse += noEventsText + '\n';
      }
      
      // Tasks header based on language
      const tasksHeader = this.userLanguage === 'ko' ? "\n## ✅ 할 일 목록\n\n" :
                         this.userLanguage === 'ja' ? "\n## ✅ タスクリスト\n\n" :
                         this.userLanguage === 'zh' ? "\n## ✅ 任务清单\n\n" :
                         "\n## ✅ Tasks\n\n";
      formattedResponse += tasksHeader;
      
      // Format tasks - organize by priority if timeRange is "all"
      if (tasksData.length > 0) {
        const activeTasks = tasksData.filter(task => task.status !== 'completed');
        
        if (activeTasks.length > 0) {
          if (timeRange === 'all') {
            // Organize tasks by priority
            const highPriorityTasks = activeTasks.filter(task => task.priority === 'high');
            const mediumPriorityTasks = activeTasks.filter(task => task.priority === 'medium');
            const lowPriorityTasks = activeTasks.filter(task => task.priority === 'low' || !task.priority);
            
            // High priority
            if (highPriorityTasks.length > 0) {
              const highLabel = this.userLanguage === 'ko' ? '### 🔴 높은 우선순위\n' :
                               this.userLanguage === 'ja' ? '### 🔴 高優先度\n' :
                               this.userLanguage === 'zh' ? '### 🔴 高优先级\n' :
                               '### 🔴 High Priority\n';
              formattedResponse += highLabel;
              for (const task of highPriorityTasks) {
                formattedResponse += `- ${task.title}`;
                if (task.due) {
                  const dueDate = new Date(task.due);
                  const locale = this.userLanguage === 'ko' ? 'ko-KR' : 
                               this.userLanguage === 'ja' ? 'ja-JP' :
                               this.userLanguage === 'zh' ? 'zh-CN' : 'en-US';
                  
                  const dueLabel = this.userLanguage === 'ko' ? '마감일' :
                                  this.userLanguage === 'ja' ? '期限' :
                                  this.userLanguage === 'zh' ? '截止日期' : 'Due';
                  
                  formattedResponse += ` (${dueLabel}: ${dueDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' })})`;
                }
                formattedResponse += "\n";
              }
              formattedResponse += "\n";
            }
            
            // Medium priority
            if (mediumPriorityTasks.length > 0) {
              const mediumLabel = this.userLanguage === 'ko' ? '### 🟡 중간 우선순위\n' :
                                 this.userLanguage === 'ja' ? '### 🟡 中優先度\n' :
                                 this.userLanguage === 'zh' ? '### 🟡 中优先级\n' :
                                 '### 🟡 Medium Priority\n';
              formattedResponse += mediumLabel;
              for (const task of mediumPriorityTasks) {
                formattedResponse += `- ${task.title}`;
                if (task.due) {
                  const dueDate = new Date(task.due);
                  const locale = this.userLanguage === 'ko' ? 'ko-KR' : 
                               this.userLanguage === 'ja' ? 'ja-JP' :
                               this.userLanguage === 'zh' ? 'zh-CN' : 'en-US';
                  
                  const dueLabel = this.userLanguage === 'ko' ? '마감일' :
                                  this.userLanguage === 'ja' ? '期限' :
                                  this.userLanguage === 'zh' ? '截止日期' : 'Due';
                  
                  formattedResponse += ` (${dueLabel}: ${dueDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' })})`;
                }
                formattedResponse += "\n";
              }
              formattedResponse += "\n";
            }
            
            // Low priority
            if (lowPriorityTasks.length > 0) {
              const lowLabel = this.userLanguage === 'ko' ? '### 🟢 낮은 우선순위\n' :
                              this.userLanguage === 'ja' ? '### 🟢 低優先度\n' :
                              this.userLanguage === 'zh' ? '### 🟢 低优先级\n' :
                              '### 🟢 Low Priority\n';
              formattedResponse += lowLabel;
              for (const task of lowPriorityTasks) {
                formattedResponse += `- ${task.title}`;
                if (task.due) {
                  const dueDate = new Date(task.due);
                  const locale = this.userLanguage === 'ko' ? 'ko-KR' : 
                               this.userLanguage === 'ja' ? 'ja-JP' :
                               this.userLanguage === 'zh' ? 'zh-CN' : 'en-US';
                  
                  const dueLabel = this.userLanguage === 'ko' ? '마감일' :
                                  this.userLanguage === 'ja' ? '期限' :
                                  this.userLanguage === 'zh' ? '截止日期' : 'Due';
                  
                  formattedResponse += ` (${dueLabel}: ${dueDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' })})`;
                }
                formattedResponse += "\n";
              }
            }
          } else {
            // Regular task list without priority grouping
            for (const task of activeTasks) {
              formattedResponse += `- ${task.title}`;
              if (task.due) {
                const dueDate = new Date(task.due);
                const locale = this.userLanguage === 'ko' ? 'ko-KR' : 
                             this.userLanguage === 'ja' ? 'ja-JP' :
                             this.userLanguage === 'zh' ? 'zh-CN' : 'en-US';
                
                const dueLabel = this.userLanguage === 'ko' ? '마감일' :
                                this.userLanguage === 'ja' ? '期限' :
                                this.userLanguage === 'zh' ? '截止日期' : 'Due';
                
                formattedResponse += ` (${dueLabel}: ${dueDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' })})`;
              }
              formattedResponse += "\n";
            }
          }
        } else {
          const noTasksText = this.userLanguage === 'ko' ? "진행 중인 할 일이 없습니다." :
                             this.userLanguage === 'ja' ? "進行中のタスクはありません。" :
                             this.userLanguage === 'zh' ? "没有进行中的任务。" :
                             "No active tasks.";
          formattedResponse += noTasksText + "\n";
        }
      } else {
        const noTasksText = this.userLanguage === 'ko' ? "진행 중인 할 일이 없습니다." :
                           this.userLanguage === 'ja' ? "進行中のタスクはありません。" :
                           this.userLanguage === 'zh' ? "没有进行中的任务。" :
                           "No active tasks.";
        formattedResponse += noTasksText + "\n";
      }
      
      // Recommendations header and content based on language
      const recommendationsHeader = this.userLanguage === 'ko' ? "\n## 💡 추천사항\n\n" :
                                   this.userLanguage === 'ja' ? "\n## 💡 おすすめ\n\n" :
                                   this.userLanguage === 'zh' ? "\n## 💡 建议\n\n" :
                                   "\n## 💡 Recommendations\n\n";
      formattedResponse += recommendationsHeader;
      
      if (this.userLanguage === 'ko') {
        formattedResponse += "1. 예정된 일정을 확인하고 필요한 준비를 하세요\n";
        formattedResponse += "2. 우선순위가 높은 작업부터 완료하세요\n";
        formattedResponse += "3. 마감일이 지난 작업들을 처리할 시간을 계획하세요\n";
      } else if (this.userLanguage === 'ja') {
        formattedResponse += "1. 予定されているイベントを確認し、必要な準備をしましょう\n";
        formattedResponse += "2. 優先度の高いタスクから完了させましょう\n";
        formattedResponse += "3. 期限切れのタスクを処理する時間を計画しましょう\n";
      } else if (this.userLanguage === 'zh') {
        formattedResponse += "1. 查看即将到来的活动并准备必要的材料\n";
        formattedResponse += "2. 优先完成高优先级的任务\n";
        formattedResponse += "3. 为逾期任务安排处理时间\n";
      } else {
        formattedResponse += "1. Review your upcoming events and prepare any necessary materials\n";
        formattedResponse += "2. Focus on completing high-priority tasks first\n";
        formattedResponse += "3. Consider scheduling time for any overdue tasks\n";
      }
      
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
        
        // Set user language before processing
        this.summaryAgent.setUserLanguage(state.userRequest);
        
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
        
        // Set user language before processing
        this.summaryAgent.setUserLanguage(state.userRequest);
        
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
      
      // Otherwise, format the data properly using Summary Agent
      if ((results.calendar || results.tasks) && this.summaryAgent) {
        const calendarData = results.calendar || [];
        const tasksData = results.tasks || [];
        
        // Set user language before processing
        this.summaryAgent.setUserLanguage(state.userRequest);
        
        // Determine time range based on request
        // If only tasks are requested (no calendar data), use "all" timeRange
        let timeRange = "week";
        const isTasksOnly = tasksData.length > 0 && calendarData.length === 0;
        
        if (state.userRequest.toLowerCase().includes("all") && isTasksOnly) {
          timeRange = "all";
        } else if (state.userRequest.toLowerCase().includes("today")) {
          timeRange = "today";
        } else if (state.userRequest.toLowerCase().includes("tomorrow")) {
          timeRange = "tomorrow";
        } else if (state.userRequest.toLowerCase().includes("month")) {
          timeRange = "month";
        }
        
        const summary = await this.summaryAgent.process(
          calendarData,
          tasksData,
          timeRange
        );
        
        return { finalResponse: summary };
      }
      
      // Fallback if no data
      return { finalResponse: "No calendar events or tasks found for your request." };
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