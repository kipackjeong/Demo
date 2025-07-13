import { useEffect, useRef } from "react";
import { Bot, Check } from "lucide-react";
import { TypingIndicator } from "@/components/TypingIndicator";
import type { Message } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatWindowProps {
  messages: Message[];
  isTyping: boolean;
}

export function ChatWindow({ messages, isTyping }: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.length === 0 && (
        <div className="flex justify-center">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="text-white" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
              Welcome to AI Agent Framework
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Start a conversation with our AI agent. Messages will stream in real-time as they're generated.
            </p>
          </div>
        </div>
      )}

      {messages.map((message, index) => (
        <div
          key={message.id || index}
          className={`flex ${
            message.role === "user" ? "justify-end" : "justify-start"
          } animate-fade-in`}
        >
          <div className="max-w-[80%] lg:max-w-[60%]">
            {message.role === "user" ? (
              <>
                <div className="user-bubble px-4 py-3 rounded-2xl rounded-tr-md">
                  <p className="text-sm text-slate-800 dark:text-white">
                    {message.content}
                  </p>
                </div>
                <div className="flex items-center justify-end mt-1 px-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatTimestamp(message.timestamp)}
                  </span>
                  <Check className="text-slate-400 ml-1" size={12} />
                </div>
              </>
            ) : (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="text-white" size={12} />
                </div>
                <div className="flex-1">
                  <div className="agent-bubble px-4 py-3 rounded-2xl rounded-tl-md">
                    <div className="text-sm text-slate-800 dark:text-white prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                  <div className="flex items-center mt-1 px-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {isTyping && <TypingIndicator />}
      <div ref={messagesEndRef} />
    </div>
  );
}
