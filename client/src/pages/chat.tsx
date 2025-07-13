import { useState, useEffect } from "react";
import { HeaderBar } from "@/components/HeaderBar";
import { ChatWindow } from "@/components/ChatWindow";
import { MessageInput } from "@/components/MessageInput";
import { GoogleAuthWarning } from "@/components/GoogleAuthWarning";
import { useSimpleWebSocket } from "@/hooks/useSimpleWebSocket";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { Message } from "@shared/schema";

interface ActionButton {
  id: string;
  label: string;
  action: string;
}

interface ExtendedMessage extends Message {
  actionButtons?: ActionButton[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(() => 
    `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Check Google integration status
  const { data: googleStatus } = useQuery({
    queryKey: ["/api/auth/google-status"],
    enabled: isAuthenticated,
    refetchInterval: 60000, // Check every minute
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to access the chat interface.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/auth";
      }, 1000);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please sign in to access the chat interface.</p>
        </div>
      </div>
    );
  }
  
  const handleMessage = (data: any) => {
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
    } else if (data.type === "action_buttons") {
      // Add action buttons to the last assistant message
      setMessages(prev => {
        const lastIndex = prev.length - 1;
        if (lastIndex >= 0 && prev[lastIndex].role === "assistant") {
          const updated = [...prev];
          updated[lastIndex] = {
            ...updated[lastIndex],
            actionButtons: data.buttons
          };
          return updated;
        }
        return prev;
      });
    } else if (data.type === "error") {
      setIsTyping(false);
      toast({
        title: "Error",
        description: data.content || "An error occurred",
        variant: "destructive"
      });
    }
  };

  const { 
    connectionStatus, 
    sendMessage: sendWebSocketMessage, 
    error 
  } = useSimpleWebSocket({ 
    url: "/chat-ws", 
    onMessage: handleMessage,
    userId: user?.id
  });

  // Send initial greeting when connected
  useEffect(() => {
    if (connectionStatus === "connected" && messages.length === 0) {
      const timer = setTimeout(() => {
        // Send the initial request to get weekly summary
        sendWebSocketMessage({
          type: "user_message",
          content: "[INITIAL_SUMMARY] Please provide me with a concise weekly summary in markdown format showing my calendar events and tasks.",
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
          role: "user",
          userId: user?.id
        });
      }, 500); // Small delay to ensure connection is fully established
      
      return () => clearTimeout(timer);
    }
  }, [connectionStatus, messages.length, sendWebSocketMessage, sessionId]);

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
      timestamp: new Date().toISOString(),
      userId: user?.id
    });
  };

  const handleNewChat = () => {
    setMessages([]);
    setIsTyping(false);
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
  };

  const handleReauthorizeGoogle = () => {
    window.location.href = "/api/auth/google?force=true";
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
        {googleStatus?.needsReauthorization && (
          <div className="px-4 py-2">
            <GoogleAuthWarning onReauthorize={handleReauthorizeGoogle} />
          </div>
        )}
        
        <ChatWindow
          messages={messages}
          isTyping={isTyping}
          onActionButtonClick={handleSendMessage}
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
