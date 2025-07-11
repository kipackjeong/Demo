import { AzureChatOpenAI } from "@langchain/azure-openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { DefaultAzureCredential } from "@azure/identity";
import { testDirectAzureOpenAI } from "./directAzureTest.js";

export class AgentService {
  private azureOpenAI: AzureChatOpenAI | null = null;
  private conversationHistory: Map<string, Array<{ role: string; content: string }>> = new Map();

  constructor() {
    this.initializeAzureOpenAI();
    // Test direct connection
    this.testDirectConnection();
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
    
    if (!this.azureOpenAI) {
      console.log("Azure OpenAI not initialized, using fallback");
      return this.getFallbackResponse(userMessage);
    }

    try {
      // Get conversation history for this session
      const history = this.conversationHistory.get(sessionId) || [];
      console.log(`Session ${sessionId} has ${history.length} messages in history`);
      
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

      console.log(`Sending ${messages.length} messages to Azure OpenAI`);
      console.log("Request details:");
      console.log("- Messages:", messages.length);
      console.log("- First message type:", messages[0]?.constructor?.name);
      console.log("- Model/deployment:", this.azureOpenAI.azureOpenAIApiDeploymentName);
      
      // Generate response with timeout
      console.log("Making Azure OpenAI request...");
      const startTime = Date.now();
      const response = await Promise.race([
        this.azureOpenAI.invoke(messages),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout after 15 seconds")), 15000))
      ]);
      console.log(`Request completed in ${Date.now() - startTime}ms`);
      
      const aiResponse = response.content as string;
      console.log(`Received response from Azure OpenAI: "${aiResponse.substring(0, 100)}..."`);

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
  }
}
