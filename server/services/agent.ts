import { AzureChatOpenAI } from "@langchain/azure-openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { DefaultAzureCredential } from "@azure/identity";
import { OpenAIAssistantAgent } from "./openaiAssistant.js";

export class AgentService {
  private azureOpenAI: AzureChatOpenAI | null = null;
  private conversationHistory: Map<string, Array<{ role: string; content: string }>> = new Map();
  private openaiAssistant: OpenAIAssistantAgent | null = null;

  constructor(user?: any) {
    this.initializeAzureOpenAI();
    
    // Try to initialize OpenAI Assistant
    try {
      this.openaiAssistant = new OpenAIAssistantAgent(user);
      console.log("OpenAI Assistant initialized successfully");
    } catch (error) {
      console.error("Failed to initialize OpenAI Assistant:", error);
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
    
    // Use OpenAI Assistant for all requests if available
    if (this.openaiAssistant) {
      try {
        console.log("Using OpenAI Assistant for response generation");
        const cleanMessage = userMessage.replace("[INITIAL_SUMMARY]", "").trim();
        const response = await this.openaiAssistant.generateResponse(cleanMessage, sessionId, isInitialSummary);
        console.log(`OpenAI Assistant response: "${response.substring(0, 100)}..."`);
        return response;
      } catch (error) {
        console.error("OpenAI Assistant failed:", error);
        // Fall back to Azure OpenAI for simple chat
      }
    }
    
    // Fall back to Azure OpenAI for simple chat
    if (this.azureOpenAI) {
      try {
        console.log("Using Azure OpenAI for chat");
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
        
        console.log(`Azure OpenAI response: "${responseText.substring(0, 100)}..."`);
        return responseText;
      } catch (error) {
        console.error("Azure OpenAI failed:", error);
        return this.getFallbackResponse(userMessage);
      }
    }
    
    // If no AI service is available, return fallback
    return this.getFallbackResponse(userMessage);
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
  }

  getSystemStatus(): Record<string, any> {
    return {
      azureOpenAI: {
        initialized: !!this.azureOpenAI,
        activeSessions: this.conversationHistory.size,
      },
      openaiAssistant: this.openaiAssistant?.getStatus() || "not initialized",
      activeSystem: this.openaiAssistant ? "openai-assistant" : (this.azureOpenAI ? "azure-openai" : "fallback"),
    };
  }
}
