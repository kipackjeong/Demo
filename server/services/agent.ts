import { AzureChatOpenAI } from "@langchain/azure-openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export class AgentService {
  private azureOpenAI: AzureChatOpenAI | null = null;
  private conversationHistory: Map<string, Array<{ role: string; content: string }>> = new Map();

  constructor() {
    this.initializeAzureOpenAI();
  }

  private initializeAzureOpenAI() {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-01";

    if (!apiKey || !endpoint || !deploymentName) {
      console.log("Azure OpenAI configuration incomplete. Using fallback responses.");
      return;
    }

    try {
      this.azureOpenAI = new AzureChatOpenAI({
        azureOpenAIApiKey: apiKey,
        azureOpenAIEndpoint: endpoint,
        azureOpenAIApiDeploymentName: deploymentName,
        azureOpenAIApiVersion: apiVersion,
        temperature: 0.7,
        maxTokens: 1000,
      });
      console.log("Azure OpenAI initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Azure OpenAI:", error);
    }
  }

  async generateResponse(userMessage: string, sessionId: string = "default"): Promise<string> {
    if (!this.azureOpenAI) {
      return this.getFallbackResponse(userMessage);
    }

    try {
      // Get conversation history for this session
      const history = this.conversationHistory.get(sessionId) || [];
      
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

      // Generate response
      const response = await this.azureOpenAI.invoke(messages);
      const aiResponse = response.content as string;

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
      return this.getFallbackResponse(userMessage);
    }
  }

  private getFallbackResponse(userMessage: string): string {
    const responses = [
      "I'm currently having trouble connecting to the AI service. Please check if your Azure OpenAI configuration is correct.",
      "It seems there's an issue with the AI service. Please verify your Azure OpenAI credentials are properly set.",
      "The AI service is temporarily unavailable. Please ensure your Azure OpenAI endpoint and API key are configured correctly.",
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  clearConversationHistory(sessionId: string) {
    this.conversationHistory.delete(sessionId);
  }
}
