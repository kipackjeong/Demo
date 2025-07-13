import { AzureChatOpenAI } from "@langchain/azure-openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { DefaultAzureCredential } from "@azure/identity";
import { testDirectAzureOpenAI } from "./directAzureTest.js";
import { LifeManagerSystemRefactored } from "./multiAgentRefactored.js";

export class AgentService {
  private azureOpenAI: AzureChatOpenAI | null = null;
  private conversationHistory: Map<string, Array<{ role: string; content: string }>> = new Map();
  private lifeManagerSystem: LifeManagerSystemRefactored;

  constructor(user?: any) {
    this.initializeAzureOpenAI();
    // Test direct connection
    this.testDirectConnection();
    // Initialize life manager system with user context
    this.lifeManagerSystem = new LifeManagerSystemRefactored(user);
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
    
    // Use life manager system if available
    if (this.lifeManagerSystem) {
      try {
        console.log("Using Life Manager system for response generation");
        const response = await this.lifeManagerSystem.process(userMessage, sessionId);
        console.log(`Life Manager system response: "${response.substring(0, 100)}..."`);
        
        // If we got a timeout error for initial summary, use a direct approach
        const isInitialSummary = userMessage.includes('[INITIAL_SUMMARY]');
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
              const calendarResult = await calendarTool.func({});
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
            let formattedResponse = "## 📅 This Week's Calendar\n\n";
            
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
              formattedResponse += "No events scheduled this week.\n";
            }
            
            formattedResponse += "\n## ✅ Tasks\n\n";
            
            if (tasks.length > 0) {
              const highPriority = tasks.filter((t: any) => t.priority === 'high');
              const mediumPriority = tasks.filter((t: any) => t.priority === 'medium');
              const lowPriority = tasks.filter((t: any) => t.priority === 'low');
              
              if (highPriority.length > 0) {
                formattedResponse += "### High Priority\n";
                for (const task of highPriority) {
                  formattedResponse += `- ${task.title}`;
                  if (task.dueDate) {
                    formattedResponse += ` (Due: ${new Date(task.dueDate).toLocaleDateString()})`;
                  }
                  formattedResponse += "\n";
                }
                formattedResponse += "\n";
              }
              
              if (mediumPriority.length > 0) {
                formattedResponse += "### Medium Priority\n";
                for (const task of mediumPriority) {
                  formattedResponse += `- ${task.title}`;
                  if (task.dueDate) {
                    formattedResponse += ` (Due: ${new Date(task.dueDate).toLocaleDateString()})`;
                  }
                  formattedResponse += "\n";
                }
                formattedResponse += "\n";
              }
              
              if (lowPriority.length > 0) {
                formattedResponse += "### Low Priority\n";
                for (const task of lowPriority) {
                  formattedResponse += `- ${task.title}`;
                  if (task.dueDate) {
                    formattedResponse += ` (Due: ${new Date(task.dueDate).toLocaleDateString()})`;
                  }
                  formattedResponse += "\n";
                }
                formattedResponse += "\n";
              }
            } else {
              formattedResponse += "No active tasks.\n\n";
            }
            
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
      lifeManager: this.lifeManagerSystem?.getSystemStatus() || null,
    };
  }
}
