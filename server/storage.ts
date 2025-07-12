import { 
  chatSessions, 
  messages,
  type ChatSession,
  type InsertChatSession,
  type Message,
  type InsertMessage
} from "@shared/schema";

export interface IStorage {
  getChatSession(sessionId: string): Promise<ChatSession | undefined>;
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  
  getMessages(sessionId: string): Promise<Message[]>;
  addMessage(message: InsertMessage): Promise<Message>;
}

export class MemStorage implements IStorage {
  private chatSessions: Map<string, ChatSession>;
  private messages: Map<string, Message[]>;
  private currentSessionId: number;
  private currentMessageId: number;

  constructor() {
    this.chatSessions = new Map();
    this.messages = new Map();
    this.currentSessionId = 1;
    this.currentMessageId = 1;
  }

  async getChatSession(sessionId: string): Promise<ChatSession | undefined> {
    return this.chatSessions.get(sessionId);
  }

  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const id = this.currentSessionId++;
    const session: ChatSession = { 
      ...insertSession, 
      id,
      userId: insertSession.userId ?? null,
      createdAt: new Date()
    };
    this.chatSessions.set(insertSession.sessionId, session);
    return session;
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    return this.messages.get(sessionId) || [];
  }

  async addMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = { 
      ...insertMessage, 
      id,
      timestamp: new Date()
    };
    
    const sessionMessages = this.messages.get(insertMessage.sessionId) || [];
    sessionMessages.push(message);
    this.messages.set(insertMessage.sessionId, sessionMessages);
    
    return message;
  }
}

export const storage = new MemStorage();
