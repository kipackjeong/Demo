import { useState, useEffect } from "react";
import { HeaderBar } from "@/components/HeaderBar";
import { ChatWindow } from "@/components/ChatWindow";
import { MessageInput } from "@/components/MessageInput";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/use-toast";
import type { Message } from "@shared/schema";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(() => 
    `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  
  const { 
    connectionStatus, 
    sendMessage: sendWebSocketMessage, 
    error 
  } = useWebSocket({
    url: "/ws",
    onMessage: (data) => {
      if (data.type === "agent_response") {
        // Handle streaming response
        setMessages(prev => {
          const existingIndex = prev.findIndex(
            m => m.sessionId === data.sessionId && m.role === "assistant" && m.id === -1
          );
          
          if (existingIndex >= 0) {
            // Update existing streaming message
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              content: updated[existingIndex].content + (data.content || "")
            };
            return updated;
          } else {
            // Create new streaming message
            return [...prev, {
              id: -1, // Temporary ID for streaming
              sessionId: data.sessionId,
              role: "assistant" as const,
              content: data.content || "",
              timestamp: new Date(),
            }];
          }
        });
      } else if (data.type === "typing") {
        setIsTyping(true);
      } else if (data.type === "done") {
        setIsTyping(false);
        // Convert streaming message to final message
        setMessages(prev => 
          prev.map(m => 
            m.id === -1 ? { ...m, id: Date.now() } : m
          )
        );
      } else if (data.type === "error") {
        setIsTyping(false);
        toast({
          title: "Error",
          description: data.content || "An error occurred",
          variant: "destructive"
        });
      }
    }
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Connection Error",
        description: error,
        variant: "destructive"
      });
    }
  }, [error, toast]);

  const handleSendMessage = (content: string) => {
    const userMessage: Message = {
      id: Date.now(),
      sessionId,
      role: "user",
      content,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    sendWebSocketMessage({
      type: "user_message",
      content,
      sessionId,
      timestamp: new Date().toISOString()
    });
  };

  const handleNewChat = () => {
    setMessages([]);
    setIsTyping(false);
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
  };

  const handleRegenerateLastResponse = () => {
    const lastUserMessage = messages.filter(m => m.role === "user").pop();
    if (lastUserMessage) {
      // Remove last assistant response
      setMessages(prev => {
        const lastAssistantIndex = prev.map(m => m.role).lastIndexOf("assistant");
        if (lastAssistantIndex >= 0) {
          return prev.slice(0, lastAssistantIndex);
        }
        return prev;
      });
      
      // Resend last user message
      sendWebSocketMessage({
        type: "user_message",
        content: lastUserMessage.content,
        sessionId,
        timestamp: new Date().toISOString()
      });
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <HeaderBar
        connectionStatus={connectionStatus}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNewChat={handleNewChat}
      />
      
      <main className="flex-1 overflow-hidden flex flex-col">
        <ChatWindow
          messages={messages}
          isTyping={isTyping}
        />
        
        <MessageInput
          onSendMessage={handleSendMessage}
          onRegenerateLastResponse={handleRegenerateLastResponse}
          disabled={connectionStatus !== "connected"}
          hasMessages={messages.length > 0}
        />
      </main>
    </div>
  );
}
