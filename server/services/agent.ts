import { AzureChatOpenAI } from "@langchain/azure-openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { DefaultAzureCredential } from "@azure/identity";
import { testDirectAzureOpenAI } from "./directAzureTest.js";
import { OpenAIAssistantAgent } from "./openaiAssistant.js";
import { IntelligentAgent } from "./intelligentAgent.js";
import { LifeManagerSystemRefactored } from "./multiAgentRefactored.js";
import { MultiAgentOrchestrator } from "./multiAgentOrchestrator.js";

export class AgentService {
  private azureOpenAI: AzureChatOpenAI | null = null;
  private conversationHistory: Map<string, Array<{ role: string; content: string }>> = new Map();
  private openaiAssistant: OpenAIAssistantAgent | null = null;
  private intelligentAgent: IntelligentAgent;
  private lifeManagerSystem: LifeManagerSystemRefactored;
  private multiAgentOrchestrator: MultiAgentOrchestrator;
  private useOpenAIAssistant: boolean = true; // Flag to switch between systems

  constructor(user?: any) {
    this.initializeAzureOpenAI();
    // Test direct connection
    this.testDirectConnection();
    
    // Try to initialize OpenAI Assistant first
    try {
      this.openaiAssistant = new OpenAIAssistantAgent(user);
      console.log("OpenAI Assistant initialized successfully");
    } catch (error) {
      console.error("Failed to initialize OpenAI Assistant:", error);
      this.useOpenAIAssistant = false;
    }
    
    // Initialize fallback systems with user context
    this.intelligentAgent = new IntelligentAgent(user);
    this.lifeManagerSystem = new LifeManagerSystemRefactored(user);
    this.multiAgentOrchestrator = new MultiAgentOrchestrator(user);
  }

  private async testDirectConnection() {
    console.log("Testing direct Azure OpenAI connection...");
    const result = await testDirectAzureOpenAI();
    if (result) {
      console.log("✓ Direct connection test passed");
    } else {
      console.log("✗ Direct connection test failed");
    }
  }

  private initializeAzureOpenAI() {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME?.trim();
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-01";

    console.log("Azure OpenAI Configuration:");
    console.log("- Endpoint:", endpoint ? `${endpoint.substring(0, 30)}...` : "Not set");
    console.log("- Deployment:", deploymentName || "Not set");
    console.log("- API Key:", apiKey ? "Set" : "Not set");
    console.log("- API Version:", apiVersion);

    if (!endpoint || !deploymentName) {
      console.log("Azure OpenAI configuration incomplete. Using fallback responses.");
      console.log("Missing:", 
        (!endpoint ? "ENDPOINT " : "") + 
        (!deploymentName ? "DEPLOYMENT_NAME " : ""));
      return;
    }

    try {
      // Try DefaultAzureCredential first, fallback to API key
      if (apiKey) {
        console.log("Using API key authentication");
        this.azureOpenAI = new AzureChatOpenAI({
          azureOpenAIApiKey: apiKey,
          azureOpenAIEndpoint: endpoint,
          azureOpenAIApiDeploymentName: deploymentName,
          azureOpenAIApiVersion: apiVersion,
          temperature: 0.7,
          maxTokens: 1000,
          timeout: 10000, // 10 second timeout
          // Additional configuration for better compatibility
          maxRetries: 1,
          // Force specific model configuration
          model: deploymentName,
        });
        console.log("Azure OpenAI initialized successfully with API key");
      } else {
        console.log("Attempting DefaultAzureCredential authentication");
        const credential = new DefaultAzureCredential();
        
        this.azureOpenAI = new AzureChatOpenAI({
          azureADTokenProvider: async () => {
            try {
              const token = await credential.getToken("https://cognitiveservices.azure.com/.default");
              console.log("Successfully obtained Azure AD token");
              return token;
            } catch (error) {
              console.error("Failed to get Azure AD token:", error);
              throw error;
            }
          },
          azureOpenAIEndpoint: endpoint,
          azureOpenAIApiDeploymentName: deploymentName,
          azureOpenAIApiVersion: apiVersion,
          temperature: 0.7,
          maxTokens: 1000,
        });
        console.log("Azure OpenAI initialized successfully with DefaultAzureCredential");
      }
    } catch (error) {
      console.error("Failed to initialize Azure OpenAI:", error);
      console.error("Error details:", error.message);
    }
  }

  async generateResponse(userMessage: string, sessionId: string = "default"): Promise<string> {
    console.log(`Generating response for session ${sessionId}: "${userMessage}"`);
    
    // Check if this is an initial summary request
    const isInitialSummary = userMessage.includes('[INITIAL_SUMMARY]');
    
    // Use OpenAI Assistant for all requests if enabled
    if (this.useOpenAIAssistant && this.openaiAssistant) {
      try {
        console.log("Using OpenAI Assistant for response generation");
        const cleanMessage = userMessage.replace("[INITIAL_SUMMARY]", "").trim();
        const response = await this.openaiAssistant.generateResponse(cleanMessage, sessionId, isInitialSummary);
        console.log(`OpenAI Assistant response: "${response.substring(0, 100)}..."`);
        return response;
      } catch (error) {
        console.error("OpenAI Assistant failed:", error);
        // Fall back to Multi-Agent Orchestrator
      }
    }
    
    // Fallback to Intelligent Agent if OpenAI Assistant is not available
    if (this.intelligentAgent) {
      try {
        console.log("Using Intelligent Agent for response generation");
        const cleanMessage = userMessage.replace("[INITIAL_SUMMARY]", "").trim();
        const response = await this.intelligentAgent.generateResponse(cleanMessage, isInitialSummary);
        console.log(`Intelligent Agent response: "${response.substring(0, 100)}..."`);
        return response;
      } catch (error) {
        console.error("Intelligent Agent failed:", error);
        // Fall back to Multi-Agent Orchestrator
      }
    }
    
    // Try using Multi-Agent Orchestrator for initial summaries
    if (isInitialSummary && this.multiAgentOrchestrator) {
      try {
        console.log("Using Multi-Agent Orchestrator for initial summary");
        const response = await this.multiAgentOrchestrator.process(userMessage, sessionId);
        console.log(`Multi-Agent Orchestrator response: "${response.substring(0, 100)}..."`);
        return response;
      } catch (error) {
        console.error("Multi-Agent Orchestrator failed:", error);
        // Fall back to Life Manager system
      }
    }
    
    // Check if the message is asking for schedule/calendar/tasks
    const scheduleKeywords = [
      'schedule', 'calendar', 'task', 'event', 'appointment', 'meeting',
      'what do i have', 'what\'s on my', 'show me my', 'list my', 'my week',
      'this week', 'today', 'tomorrow', 'next week'
    ];
    const isScheduleRequest = scheduleKeywords.some(keyword => 
      userMessage.toLowerCase().includes(keyword)
    );
    
    // For regular chat messages that don't need tools, try direct Azure OpenAI
    if (!isInitialSummary && !isScheduleRequest && this.azureOpenAI) {
      try {
        console.log("Using direct Azure OpenAI for regular chat");
        const cleanMessage = userMessage.replace("[INITIAL_SUMMARY]", "").trim();
        
        // Get conversation history
        const conversationHistory = this.conversationHistory.get(sessionId) || [];
        
        // Build messages array
        const messages = [
          new SystemMessage("You are a helpful AI assistant that helps users manage their schedule and tasks. Be conversational and helpful."),
          ...conversationHistory.map(msg => 
            msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
          ),
          new HumanMessage(cleanMessage)
        ];
        
        // Simple Azure OpenAI call without tools
        const response = await this.azureOpenAI.invoke(messages, {
          temperature: 0.7,
          maxTokens: 1000,
          timeout: 15000, // 15 second timeout
          maxRetries: 1,
        });
        
        const responseText = response.content as string;
        
        // Update conversation history
        conversationHistory.push(
          { role: 'user', content: cleanMessage },
          { role: 'assistant', content: responseText }
        );
        this.conversationHistory.set(sessionId, conversationHistory);
        
        console.log(`Direct Azure OpenAI response: "${responseText.substring(0, 100)}..."`);
        return responseText;
      } catch (error) {
        console.error("Direct Azure OpenAI failed:", error);
        // Fall back to Life Manager system
      }
    }
    
    // For schedule requests, use the Multi-Agent Orchestrator
    if (isScheduleRequest && this.multiAgentOrchestrator) {
      try {
        console.log("Using Multi-Agent Orchestrator for schedule request");
        const response = await this.multiAgentOrchestrator.process(userMessage, sessionId);
        console.log(`Multi-Agent Orchestrator response: "${response.substring(0, 100)}..."`);
        return response;
      } catch (error) {
        console.error("Multi-Agent Orchestrator failed:", error);
        // Fall back to Life Manager system
      }
    }
    
    // Use life manager system as fallback
    if (this.lifeManagerSystem) {
      try {
        console.log("Using Life Manager system for response generation");
        const response = await this.lifeManagerSystem.process(userMessage, sessionId);
        console.log(`Life Manager system response: "${response.substring(0, 100)}..."`);
        
        // If we got a timeout error for initial summary, use a direct approach
        if (isInitialSummary && response.includes("I encountered an error")) {
          console.log("Life Manager timeout - using direct approach for initial summary");
          
          try {
            // Get tools and call them directly
            const tools = this.lifeManagerSystem.mcpToolAdapter.getTools();
            console.log("Available tools:", tools.map(t => t.name));
            
            const calendarTool = tools.find(t => t.name === 'get_calendar_events');
            const tasksTool = tools.find(t => t.name === 'get_tasks');
            
            let calendarEvents = [];
            let tasks = [];
            
            if (calendarTool) {
              console.log("Calling calendar tool...");
              const calendarResult = await calendarTool.func({
                calendarId: 'primary',
                timeMin: new Date().toISOString(),
                timeMax: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
              });
              console.log("Calendar result:", calendarResult);
              calendarEvents = JSON.parse(calendarResult);
            }
            
            if (tasksTool) {
              console.log("Calling tasks tool...");
              const tasksResult = await tasksTool.func({});
              console.log("Tasks result:", tasksResult);
              tasks = JSON.parse(tasksResult);
            }
            
            // Format the response
            let formattedResponse = "## 📅 Next 3 Days\n\n";
            
            if (calendarEvents.length > 0) {
              for (const event of calendarEvents) {
                const startDate = new Date(event.start);
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
                
                formattedResponse += `- **${event.title || 'Untitled Event'}** - ${dateStr}, ${timeStr}\n`;
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
            
            if (tasks.length > 0) {
              // Google Tasks don't have priority field, so just list all tasks
              for (const task of tasks) {
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
            formattedResponse += "\n";
            
            formattedResponse += "## 💡 Recommendations\n\n";
            formattedResponse += "1. Review your upcoming events and prepare any necessary materials\n";
            formattedResponse += "2. Focus on completing high-priority tasks first\n";
            formattedResponse += "3. Consider scheduling time for any overdue tasks\n";
            
            console.log("\n=== DIRECT APPROACH FINAL RESPONSE ===");
            console.log("Generated formatted response with:");
            console.log("- Calendar events:", calendarEvents.length);
            console.log("- Tasks:", tasks.length);
            console.log("Response preview:", formattedResponse.substring(0, 200) + "...");
            
            return formattedResponse;
          } catch (directError) {
            console.error("Direct approach also failed:", directError);
            return response; // Return the original error response
          }
        }
        
        return response;
      } catch (error) {
        console.error("Life Manager system error, falling back to single agent:", error);
        // Fall through to single agent backup
      }
    }

    // Fallback to single agent if multi-agent fails
    if (!this.azureOpenAI) {
      console.log("Azure OpenAI not initialized, using fallback");
      return this.getFallbackResponse(userMessage);
    }

    try {
      // Get conversation history for this session
      const history = this.conversationHistory.get(sessionId) || [];
      console.log(`Single agent: Session ${sessionId} has ${history.length} messages in history`);
      
      // Add user message to history
      history.push({ role: "user", content: userMessage });
      
      // Build messages for the AI
      const messages = [
        new SystemMessage(`You are a helpful AI assistant built with a real-time chatbot framework. 
        You provide clear, concise, and helpful responses. Keep your responses conversational and engaging.
        This framework uses React, TypeScript, WebSocket connections, and LangChain for AI integration.`),
        ...history.slice(-10).map(msg => 
          msg.role === "user" 
            ? new HumanMessage(msg.content)
            : new SystemMessage(msg.content)
        )
      ];

      console.log(`Single agent: Sending ${messages.length} messages to Azure OpenAI`);
      
      // Generate response with timeout
      const startTime = Date.now();
      const response = await Promise.race([
        this.azureOpenAI.invoke(messages),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout after 15 seconds")), 15000))
      ]);
      console.log(`Single agent: Request completed in ${Date.now() - startTime}ms`);
      
      const aiResponse = response.content as string;
      console.log(`Single agent response: "${aiResponse.substring(0, 100)}..."`);

      // Add AI response to history
      history.push({ role: "assistant", content: aiResponse });
      
      // Keep only last 20 messages to manage memory
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }
      
      this.conversationHistory.set(sessionId, history);

      return aiResponse;
    } catch (error) {
      console.error("Error generating Azure OpenAI response:", error);
      console.error("Error details:", error.message);
      return this.getFallbackResponse(userMessage);
    }
  }

  private getFallbackResponse(userMessage: string): string {
    const responses = [
      "I'm currently having trouble connecting to the Azure OpenAI service. There appears to be an authentication issue with the API key or endpoint configuration.",
      "The AI service is temporarily unavailable due to a connection error. Please verify your Azure OpenAI credentials are correct.",
      "I'm experiencing connection issues with the AI service. This may be due to incorrect API endpoint or authentication problems.",
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  clearConversationHistory(sessionId: string) {
    this.conversationHistory.delete(sessionId);
    if (this.lifeManagerSystem) {
      this.lifeManagerSystem.clearConversationHistory(sessionId);
    }
  }

  getSystemStatus(): Record<string, any> {
    return {
      singleAgent: {
        azureOpenAIInitialized: !!this.azureOpenAI,
        activeSessions: this.conversationHistory.size,
      },
      openaiAssistant: this.openaiAssistant?.getStatus() || "not initialized",
      lifeManager: this.lifeManagerSystem?.getSystemStatus() || null,
      multiAgentOrchestrator: this.multiAgentOrchestrator?.getSystemStatus() || "not initialized",
      activeSystem: this.useOpenAIAssistant ? "openai-assistant" : "multi-agent",
      usingOpenAIAssistant: this.useOpenAIAssistant,
    };
  }
}
