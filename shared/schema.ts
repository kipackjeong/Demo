import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(), // "user" or "assistant"
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).pick({
  sessionId: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  sessionId: true,
  role: true,
  content: true,
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;

// WebSocket message types
export const webSocketMessageSchema = z.object({
  type: z.enum(["user_message", "agent_response", "typing", "done", "error", "connected"]),
  content: z.string().optional(),
  sessionId: z.string(),
  timestamp: z.string().optional(),
  role: z.enum(["user", "assistant"]).optional(),
});

export type WebSocketMessage = z.infer<typeof webSocketMessageSchema>;
