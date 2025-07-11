import { useState, useRef, useEffect } from "react";
import { Send, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  onRegenerateLastResponse: () => void;
  disabled: boolean;
  hasMessages: boolean;
}

export function MessageInput({
  onSendMessage,
  onRegenerateLastResponse,
  disabled,
  hasMessages
}: MessageInputProps) {
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const handleSubmit = () => {
    const content = inputValue.trim();
    if (content && !disabled) {
      onSendMessage(content);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-4">
      <div className="max-w-4xl mx-auto">
        <div className="relative">
          <div className="flex items-end space-x-3">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                className="w-full px-4 py-3 pr-12 border border-slate-300 dark:border-slate-600 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 transition-colors duration-200"
                rows={1}
                disabled={disabled}
                style={{ maxHeight: "120px" }}
              />
              <Button
                onClick={handleSubmit}
                disabled={!inputValue.trim() || disabled}
                size="sm"
                className="absolute right-2 bottom-2 w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 disabled:cursor-not-allowed"
              >
                <Send size={14} />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Press Enter to send, Shift+Enter for new line</span>
            </div>
            {hasMessages && (
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRegenerateLastResponse}
                  className="px-3 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors duration-200"
                >
                  <RotateCcw size={12} className="mr-1" />
                  Regenerate
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
