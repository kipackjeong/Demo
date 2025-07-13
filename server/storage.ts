import { 
  chatSessions, 
  messages,
  users,
  type ChatSession,
  type InsertChatSession,
  type Message,
  type InsertMessage,
  type User,
  type InsertUser
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  
  // Chat operations
  getChatSession(sessionId: string): Promise<ChatSession | undefined>;
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  
  getMessages(sessionId: string): Promise<Message[]>;
  addMessage(message: InsertMessage): Promise<Message>;
}

export class MemStorage implements IStorage {
  private chatSessions: Map<string, ChatSession>;
  private messages: Map<string, Message[]>;
  private users: Map<number, User>;
  private usersByEmail: Map<string, User>;
  private usersByGoogleId: Map<string, User>;
  private currentSessionId: number;
  private currentMessageId: number;
  private currentUserId: number;

  constructor() {
    this.chatSessions = new Map();
    this.messages = new Map();
    this.users = new Map();
    this.usersByEmail = new Map();
    this.usersByGoogleId = new Map();
    this.currentSessionId = 1;
    this.currentMessageId = 1;
    this.currentUserId = 1;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.usersByEmail.get(email);
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    return this.usersByGoogleId.get(googleId);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      id,
      email: userData.email,
      password: userData.password ?? null,
      firstName: userData.firstName ?? null,
      lastName: userData.lastName ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
      googleId: userData.googleId ?? null,
      googleAccessToken: null,
      googleRefreshToken: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.users.set(id, user);
    this.usersByEmail.set(userData.email, user);
    if (userData.googleId) {
      this.usersByGoogleId.set(userData.googleId, user);
    }
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      throw new Error("User not found");
    }
    
    const updatedUser: User = {
      ...existingUser,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.users.set(id, updatedUser);
    this.usersByEmail.set(updatedUser.email, updatedUser);
    if (updatedUser.googleId) {
      this.usersByGoogleId.set(updatedUser.googleId, updatedUser);
    }
    
    return updatedUser;
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
