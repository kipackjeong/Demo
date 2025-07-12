import { StateGraph, END, START } from "@langchain/langgraph";
import { AzureChatOpenAI } from "@langchain/azure-openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { BaseMessage } from "@langchain/core/messages";

// Define the state interface for the multi-agent system
interface AgentState {
  messages: BaseMessage[];
  userMessage: string;
  sessionId: string;
  agentDecision: string;
  finalResponse: string;
  context: Record<string, any>;
}

export class MultiAgentSystem {
  private azureOpenAI: AzureChatOpenAI | null = null;
  private conversationHistory: Map<string, Array<{ role: string; content: string }>> = new Map();
  private graph: StateGraph<AgentState> | null = null;

  constructor() {
    this.initializeAzureOpenAI();
    this.setupGraph();
  }

  private initializeAzureOpenAI() {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME?.trim();
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-01";

    if (!endpoint || !deploymentName) {
      console.log("Multi-agent system: Azure OpenAI configuration incomplete");
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
        console.log("Multi-agent system: Azure OpenAI initialized successfully");
      }
    } catch (error) {
      console.error("Multi-agent system: Failed to initialize Azure OpenAI:", error);
    }
  }

  private setupGraph() {
    // Create the state graph
    const workflow = new StateGraph<AgentState>({
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
      },
    });

    // Add nodes to the graph
    workflow.addNode("router", this.routerAgent.bind(this));
    workflow.addNode("conversational_agent", this.conversationalAgent.bind(this));
    workflow.addNode("technical_agent", this.technicalAgent.bind(this));
    workflow.addNode("creative_agent", this.creativeAgent.bind(this));
    workflow.addNode("finalizer", this.finalizerAgent.bind(this));

    // Define the workflow edges
    workflow.addEdge(START, "router");
    
    // Conditional edges from router to different agents
    workflow.addConditionalEdges(
      "router",
      this.routeToAgent.bind(this),
      {
        "conversational": "conversational_agent",
        "technical": "technical_agent",
        "creative": "creative_agent",
      }
    );

    // All agents flow to finalizer
    workflow.addEdge("conversational_agent", "finalizer");
    workflow.addEdge("technical_agent", "finalizer");
    workflow.addEdge("creative_agent", "finalizer");
    workflow.addEdge("finalizer", END);

    this.graph = workflow.compile();
    console.log("Multi-agent system: Graph compiled successfully");
  }

  // Router agent decides which specialized agent to use
  private async routerAgent(state: AgentState): Promise<Partial<AgentState>> {
    if (!this.azureOpenAI) {
      return { agentDecision: "conversational" };
    }

    try {
      const routerPrompt = `You are a routing agent that decides which specialized agent should handle a user's request.

Analyze the user's message and classify it into one of these categories:
- "conversational": General chat, greetings, casual conversation
- "technical": Programming questions, technical explanations, debugging help
- "creative": Creative writing, storytelling, brainstorming, artistic tasks

User message: "${state.userMessage}"

Respond with only the category name (conversational, technical, or creative).`;

      const messages = [new SystemMessage(routerPrompt)];
      const response = await this.azureOpenAI.invoke(messages);
      const decision = (response.content as string).trim().toLowerCase();

      console.log(`Router decision: ${decision} for message: "${state.userMessage}"`);
      
      return { 
        agentDecision: ["conversational", "technical", "creative"].includes(decision) ? decision : "conversational",
        context: { routingReason: decision }
      };
    } catch (error) {
      console.error("Router agent error:", error);
      return { agentDecision: "conversational" };
    }
  }

  // Route to the appropriate agent based on router decision
  private routeToAgent(state: AgentState): string {
    return state.agentDecision || "conversational";
  }

  // Conversational agent for general chat
  private async conversationalAgent(state: AgentState): Promise<Partial<AgentState>> {
    if (!this.azureOpenAI) {
      return { finalResponse: "I'm having trouble connecting to the AI service right now." };
    }

    try {
      const history = this.conversationHistory.get(state.sessionId) || [];
      
      const messages = [
        new SystemMessage(`You are a friendly, conversational AI assistant. 
        Engage in natural, helpful conversation. Be warm, personable, and supportive.
        Keep responses concise but engaging.`),
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
      console.error("Conversational agent error:", error);
      return { finalResponse: "I'm having trouble processing your request right now." };
    }
  }

  // Technical agent for programming and technical questions
  private async technicalAgent(state: AgentState): Promise<Partial<AgentState>> {
    if (!this.azureOpenAI) {
      return { finalResponse: "I'm having trouble connecting to the AI service right now." };
    }

    try {
      const history = this.conversationHistory.get(state.sessionId) || [];
      
      const messages = [
        new SystemMessage(`You are a technical AI assistant specializing in programming, software development, and technical problem-solving.
        
        Provide clear, accurate technical explanations and solutions. Include:
        - Code examples when relevant
        - Step-by-step explanations
        - Best practices and common pitfalls
        - Alternative approaches when applicable
        
        Be precise and thorough while remaining accessible.`),
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
      console.error("Technical agent error:", error);
      return { finalResponse: "I'm having trouble processing your technical request right now." };
    }
  }

  // Creative agent for creative tasks
  private async creativeAgent(state: AgentState): Promise<Partial<AgentState>> {
    if (!this.azureOpenAI) {
      return { finalResponse: "I'm having trouble connecting to the AI service right now." };
    }

    try {
      const history = this.conversationHistory.get(state.sessionId) || [];
      
      const messages = [
        new SystemMessage(`You are a creative AI assistant specializing in creative writing, storytelling, brainstorming, and artistic tasks.
        
        Be imaginative, inspiring, and original. Help users with:
        - Creative writing and storytelling
        - Brainstorming and ideation
        - Artistic concepts and descriptions
        - Creative problem-solving
        
        Encourage creativity while providing practical, actionable guidance.`),
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
      console.error("Creative agent error:", error);
      return { finalResponse: "I'm having trouble processing your creative request right now." };
    }
  }

  // Finalizer agent to polish and format the final response
  private async finalizerAgent(state: AgentState): Promise<Partial<AgentState>> {
    // For now, just return the response as-is
    // In the future, this could add formatting, fact-checking, etc.
    return { finalResponse: state.finalResponse };
  }

  // Main method to generate response using the multi-agent system
  async generateResponse(userMessage: string, sessionId: string = "default"): Promise<string> {
    if (!this.graph) {
      console.log("Multi-agent system not initialized, falling back to simple response");
      return "I'm currently setting up the multi-agent system. Please try again in a moment.";
    }

    try {
      console.log(`Multi-agent system processing: "${userMessage}" for session: ${sessionId}`);
      
      const initialState: AgentState = {
        messages: [],
        userMessage,
        sessionId,
        agentDecision: "",
        finalResponse: "",
        context: {},
      };

      const result = await this.graph.invoke(initialState);
      
      console.log(`Multi-agent system completed with decision: ${result.agentDecision}`);
      return result.finalResponse || "I'm having trouble generating a response right now.";
    } catch (error) {
      console.error("Multi-agent system error:", error);
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
    };
  }
}